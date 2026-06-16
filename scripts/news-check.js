// SessionStart 用: 地域ニュース(data/region-news.json)が本日分に更新されているか確認し、
// 古ければ Claude に最新化を促すメッセージを出力する(出力はセッション開始時のコンテキストに入る)。
//
// フック設定(settings.local.json の SessionStart hooks に1行追加):
//   { "type": "command", "command": "node C:/eigyo-pro/scripts/news-check.js" }
//
// ※これは「表示用ニュースデータ」の鮮度チェックのみ。集計(数字)には一切関与しない。
try {
  const path = require('path');
  const file = path.join(__dirname, '..', 'data', 'region-news.json');
  const d = require(file);
  const n = new Date();
  const t = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  if (d.generatedAt !== t) {
    console.log('[地域ニュース更新が必要] 前回=' + d.generatedAt + ' / 本日=' + t);
    console.log('→ Claudeへ: まずユーザーに「起動時チェック: 地域ニュースを最新化します」と一言伝えてから、update-region-news スキルの手順で各エリアの直近ニュースをWebSearchで集め、C:/eigyo-pro/data/region-news.json を本日分に最新化し generatedAt を ' + t + ' にして commit/push してください(全件下書き・出典付き・会社名/数字はneedsVerify=true・集計には触れない)。');
  } else {
    console.log('[地域ニュース] 本日分(' + t + ')に更新済み。最新化は不要。');
  }
} catch (e) {
  console.log('[地域ニュース確認スキップ] ' + e.message);
}
