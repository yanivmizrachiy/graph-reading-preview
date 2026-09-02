import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const index = read('index.html');
const js = read('graph-reading-workbook.js');
const css = read('graph-reading-workbook.css');
const readme = read('README.md');
const meta = JSON.parse(read('meta/graph-reading-workbook.json'));

const failures = [];
const fail = (message) => failures.push(message);
const requireText = (text, needle, where) => {
  if (!text.includes(needle)) fail(`${where}: missing required contract text: ${needle}`);
};
const forbidText = (text, needle, where) => {
  if (text.includes(needle)) fail(`${where}: forbidden legacy/demo text returned: ${needle}`);
};

// Single entrypoint / no alternate demo viewers.
for (const path of ['demo.html', 'דפים.html', 'CLAUDE-CODE-HANDOFF.md']) {
  if (existsSync(join(root, path))) fail(`obsolete alternate file must not exist: ${path}`);
}

const assetsDir = join(root, 'assets');
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (/-fixes\.js$/i.test(name)) fail(`obsolete runtime patch must not exist: assets/${name}`);
  }
}

// No demo/marketing layer and no manual display controls.
for (const forbidden of [
  'id="zoomMode"',
  'class="zoom-control"',
  'class="mode-switch"',
  'id="colorMode"',
  'id="bwMode"',
  'id="viewerModeLabel"',
  'id="viewerHelp"',
  'id="sourceBadge"',
  'class="viewer-head"',
  'class="intro"',
  'class="legend"',
  'דפדוף נוח',
  '<b>A4</b>',
  'חוברת דיגיטלית ·'
]) forbidText(index, forbidden, 'index.html');

// Only the compact action bar, page navigation and workbook are visible.
for (const required of [
  'class="action-bar"',
  'id="printButton"',
  'id="downloadButton"',
  'id="fullscreenButton"',
  'id="prevPage"',
  'id="pageNumber"',
  'id="pageCount"',
  'id="nextPage"',
  'id="pdfFrame"'
]) requireText(index, required, 'index.html');

// Print choices are hidden until the print button is pressed.
requireText(index, 'aria-controls="printMenu"', 'index.html');
requireText(index, 'id="printMenu" class="print-menu" role="menu" hidden', 'index.html');
requireText(index, 'id="printColor"', 'index.html');
requireText(index, 'id="printBw"', 'index.html');
requireText(css, '.print-menu[hidden] { display: none; }', 'graph-reading-workbook.css');

// The normal viewer is always color. B/W exists only as a print target.
forbidText(js, "params.get('mode')", 'graph-reading-workbook.js');
forbidText(js, "$('colorMode')", 'graph-reading-workbook.js');
forbidText(js, "$('bwMode')", 'graph-reading-workbook.js');
requireText(js, 'const file = manifest.files.color;', 'graph-reading-workbook.js');
requireText(js, "printColor.addEventListener('click', () => openPrintVersion('color'))", 'graph-reading-workbook.js');
requireText(js, "printBw.addEventListener('click', () => openPrintVersion('bw'))", 'graph-reading-workbook.js');

// Mobile/tablet HTML viewer: continuous pages, no gaps/shadows, one navy divider.
requireText(js, "const BOOK_HTML = 'מאגר-מלא.html';", 'graph-reading-workbook.js');
requireText(js, 'margin: 0 auto !important;', 'graph-reading-workbook.js');
requireText(js, 'box-shadow: none !important;', 'graph-reading-workbook.js');
requireText(js, 'border-top: 3px solid #0f2747 !important;', 'graph-reading-workbook.js');
requireText(js, 'availableWidth / sheetPx', 'graph-reading-workbook.js');

// Page counter must follow actual scrolling, not only navigation buttons.
for (const required of [
  'function updatePageFromBookScroll()',
  'function installBookScrollTracking()',
  "win.addEventListener('scroll'",
  'pageInput.value = String(page);',
  'requestAnimationFrame(updatePageFromBookScroll)'
]) requireText(js, required, 'graph-reading-workbook.js');

// Release id is one value everywhere.
const indexRelease = index.match(/name="graph-reading-release" content="([^"]+)"/)?.[1];
const jsRelease = js.match(/const RELEASE_VERSION = '([^']+)'/)?.[1];
if (!indexRelease) fail('index.html: missing graph-reading-release meta');
if (!jsRelease) fail('graph-reading-workbook.js: missing RELEASE_VERSION');
if (indexRelease && jsRelease && indexRelease !== jsRelease) {
  fail(`release mismatch: index=${indexRelease}, js=${jsRelease}`);
}
if (indexRelease && meta.release !== indexRelease) {
  fail(`release mismatch: meta=${meta.release}, index=${indexRelease}`);
}

// README must preserve the source-of-truth contract for future agents/developers.
for (const required of [
  'מקור האמת היחיד',
  '`index.html` — נקודת הכניסה היחידה',
  '`מאגר-מלא.html` — מקור ה-HTML היחיד',
  'אין תפריט "תצוגה"',
  'מונה העמודים חייב לעקוב אחרי הגלילה בפועל',
  'אין ליצור מקור אמת נוסף'
]) requireText(readme, required, 'README.md');

if (failures.length) {
  console.error('\nViewer contract FAILED:\n');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Viewer contract OK: single source of truth and current UX rules are preserved.');
