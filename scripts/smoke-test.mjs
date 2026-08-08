// 🧪 スモークテスト: index.html をヘッドレスブラウザで読み込み、
//   ①JSエラーが無いか ②主要関数が定義されているか ③Dが生成されるか
//   ④スマホ判定が効くか ⑤横スクロールが出ていないか を確認する。
//   1つでも失敗したら exit 1（GitHub Actions が赤=失敗になる）。
// 使い方: node scripts/smoke-test.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

// 定義されていないと「全体が壊れている」可能性が高い主要関数
const REQUIRED = [
  'showTab', 'rebuildAll', 'save', 'load',
  'renderMHome', 'renderMCust', 'renderMDeals', 'renderMAct',
  'mobHome', 'mobCust', 'mobDeals', 'mobAct', 'mobToggleQL', 'mobToggleDrawer',
  '_hasRealData', '_isMobileUI', 'setDealPhase', 'getActualValue', 'getBudgetValue'
];

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => { const s = document.getElementById('login-screen'); if (s) s.style.display = 'none'; });
await page.waitForTimeout(300);

const check = await page.evaluate((req) => {
  const missing = req.filter(f => typeof window[f] !== 'function');
  return {
    missing,
    dExists: (typeof D !== 'undefined'),
    isMobile: (typeof window._isMobileUI === 'function') ? window._isMobileUI() : null,
    bottomNav: (() => { const e = document.getElementById('mob-nav'); return !!(e && getComputedStyle(e).display !== 'none'); })(),
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1
  };
}, REQUIRED);

await browser.close();

const fail = [];
if (errors.length) fail.push('JSエラー検出: ' + errors.join(' | '));
if (check.missing.length) fail.push('主要関数が未定義: ' + check.missing.join(', '));
if (!check.dExists) fail.push('データオブジェクト D が未定義');
if (check.isMobile !== true) fail.push('スマホ判定が有効にならない (bottomNav=' + check.bottomNav + ')');
if (check.hScroll) fail.push('横スクロールが発生している');

if (fail.length) {
  console.error('❌ スモークテスト失敗:');
  fail.forEach(m => console.error('   - ' + m));
  process.exit(1);
}
console.log('✅ スモークテスト合格: JSエラー0 / 主要関数OK / D生成OK / スマホ判定OK / 横スクロール無し');
