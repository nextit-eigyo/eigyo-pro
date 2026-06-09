// 地域ニュースアンテナ 自動収集スクリプト（GitHub Actions から平日朝に実行）
// 各エリアを Claude + web_search で収集し data/region-news.json を更新する。
// 仕様の詳細は data/region-news-generator.md を参照。
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic(); // ANTHROPIC_API_KEY を環境変数から読む

// JSTの当日(YYYY-MM-DD)
const jst = new Date(Date.now() + 9 * 3600 * 1000);
const TODAY = jst.toISOString().slice(0, 10);

// 拠点＝担当リージョン定義
const BRANCHES = [
  { name: "神戸本社", region: "関西エリア", prefectures: ["兵庫","大阪","京都","滋賀","奈良","和歌山"] },
  { name: "福岡営業所", region: "九州エリア", prefectures: ["福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島"] },
  { name: "高知営業所", region: "四国エリア", prefectures: ["高知","徳島","愛媛","香川"] },
  { name: "東京事業所", region: "関東エリア", prefectures: ["東京","神奈川","埼玉","千葉","茨城","栃木","群馬"] },
  { name: "新潟営業所", region: "甲信越・北陸エリア", prefectures: ["新潟","長野","富山","石川","福井","山梨"] },
  { name: "全国", region: "調剤薬局業界ニュース（全国版）", prefectures: ["全国"], national: true },
];

const SCHEMA_HINT = `次のJSON配列のみを出力（説明文やコードフェンスは一切付けない）。各要素:
{"pref":"県名(複数は・区切り/全域は『〇〇全域』)","date":"YYYY-MM-DD(記事のおおよその日付・不明なら${TODAY})","type":"M&A|承継|大手再編|改定・業界動向|業界動向|一次情報源|ターゲット把握","needsVerify":true/false(会社名/店舗数/件数/金額/時期を含むなら必ずtrue),"title":"見出し","summary":"1〜2文。なぜ卸訪問/開局/入替に効くかの営業目線","source":{"label":"媒体名","url":"https://実在URL"}}
ルール: 出典URLが実在しないものは載せない。数字・固有名詞を創作しない。新規開局のピンポイントはネットに出にくいので無理に作らず、拾えなければ業界動向＋一次情報源(県薬剤師会等)でよい。1エリア3〜6件。`;

// web_search を使う1リクエスト。server tool の pause_turn をループ処理し、最終テキストを返す。
async function ask(prompt) {
  let messages = [{ role: "user", content: prompt }];
  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: res.content }];
      continue;
    }
    return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  }
  return "[]";
}

function parseItems(text) {
  // コードフェンスや前後文を除いてJSON配列を取り出す
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { const a = JSON.parse(m[0]); return Array.isArray(a) ? a : []; } catch { return []; }
}

const out = { generatedAt: TODAY, branches: [] };

for (const b of BRANCHES) {
  const prompt = b.national
    ? `あなたは調剤レセコンメーカーの営業サポートです。${TODAY}時点で、調剤薬局業界全体の"目新しい"全国ニュースを web_search で集めてください（pref は全件「全国」）。
テーマ: 薬局AI/生成AI・DX・新サービス/新製品・大手の提携や新規事業・調剤ロボット・電子薬歴の進化・オンライン服薬指導・リフィル/長期処方の新展開・補助金/ICT基金・大型M&A/再編の最新。
❌周知の基礎事項は載せない: 2026改定の「地域支援・医薬品供給対応体制加算への再編」「後発品85%」「調剤室16㎡」等、業界なら誰でも知っている要点は除外。「で、何が新しい？」が言える記事だけ。
${SCHEMA_HINT}`
    : `あなたは調剤レセコンメーカーの営業サポートです。${TODAY}時点で、${b.region}（対象県: ${b.prefectures.join("・")}）の調剤薬局に関する直近ニュースを web_search で集めてください。
テーマ: M&A / 事業承継 / 大手の再編・出店 / 2026年度調剤報酬改定の影響 / 新規開局・クリニック開業。
${SCHEMA_HINT}`;
  let items = [];
  try { items = parseItems(await ask(prompt)); } catch (e) { console.error(b.name, "失敗", e.message); }
  const verified = items.filter((it) => it && it.title && it.source && it.source.url);
  out.branches.push({
    name: b.name, region: b.region, prefectures: b.prefectures,
    coverage: verified.length >= 3 ? "good" : verified.length >= 1 ? "medium" : "thin",
    coverageNote: verified.length >= 1
      ? "自動収集。会社名・数字は要確認。新規開局のピンポイントは卸MS・保健所が本命。"
      : "今回はネット上で具体ニュースを拾えず。県薬剤師会・卸MSの一次情報が本命。",
    items: verified,
  });
  console.log(`${b.name}: ${verified.length}件`);
}

fs.writeFileSync("data/region-news.json", JSON.stringify(out, null, 2) + "\n");
console.log("data/region-news.json を更新:", TODAY);
