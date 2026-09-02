import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const index = read('index.html');
const js = read('graph-reading-workbook.js');
const css = read('graph-reading-workbook.css');
const readme = read('README.md');
const master = read('מאגר-מלא.html');
const meta = JSON.parse(read('meta/graph-reading-workbook.json'));

const failures = [];
const fail = (message) => failures.push(message);
const requireText = (text, needle, where) => {
  if (!text.includes(needle)) fail(`${where}: missing required contract text: ${needle}`);
};
const forbidText = (text, needle, where) => {
  if (text.includes(needle)) fail(`${where}: forbidden legacy/demo text returned: ${needle}`);
};

// One active viewer and one active HTML workbook source.
for (const path of [
  'demo.html',
  'דפים.html',
  'CLAUDE-CODE-HANDOFF.md',
  'הסתברות',
  'רמה 1',
  'רמה 2',
  'רמה 3',
  'רמה 4',
  'רמה 5'
]) {
  if (existsSync(join(root, path))) fail(`obsolete alternate source must not exist: ${path}`);
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
  'חוברת דיגיטלית ·',
  '<select'
]) forbidText(index, forbidden, 'index.html');

// Only compact actions, page navigation and workbook frame are visible above the book.
for (const required of [
  'class="action-bar"',
  'id="printButton"',
  'id="downloadButton"',
  'id="fullscreenButton"',
  'id="prevPage"',
  'id="pageNumber"',
  'id="pageCount"',
  'id="nextPage"',
  'id="bookFrame"'
]) requireText(index, required, 'index.html');
forbidText(index, 'id="pdfFrame"', 'index.html');
forbidText(css, '#pdfFrame', 'graph-reading-workbook.css');
forbidText(js, "$('pdfFrame')", 'graph-reading-workbook.js');

// Print choices are hidden until the print button is pressed.
requireText(index, 'aria-controls="printMenu"', 'index.html');
requireText(index, 'id="printMenu" class="print-menu" role="menu" hidden', 'index.html');
requireText(index, 'id="printColor"', 'index.html');
requireText(index, 'id="printBw"', 'index.html');
requireText(css, '.print-menu[hidden] { display: none; }', 'graph-reading-workbook.css');
requireText(js, "printColor.addEventListener('click', () => openPrintVersion('color'))", 'graph-reading-workbook.js');
requireText(js, "printBw.addEventListener('click', () => openPrintVersion('bw'))", 'graph-reading-workbook.js');

// The regular viewer is always the same HTML workbook on every device.
for (const forbidden of [
  'usesHtmlBook',
  'navigator.userAgent',
  'maxTouchPoints',
  'pdfViewUrl',
  'previewUrl',
  "params.get('mode')",
  "$('colorMode')",
  "$('bwMode')",
  'worksheet-bw.css'
]) forbidText(js, forbidden, 'graph-reading-workbook.js');
requireText(js, "const frame = $('bookFrame');", 'graph-reading-workbook.js');
requireText(js, 'מאגר-מלא.html?v=${RELEASE_VERSION}', 'graph-reading-workbook.js');
requireText(js, 'function renderBook()', 'graph-reading-workbook.js');
requireText(js, 'frame.src = BOOK_HTML;', 'graph-reading-workbook.js');
requireText(js, 'const file = manifest.files.color;', 'graph-reading-workbook.js');

// Continuous pages and automatic fit on every device.
for (const required of [
  'function applyBookLayout()',
  'margin: 0 auto !important;',
  'box-shadow: none !important;',
  'border-top: 3px solid #0f2747 !important;',
  'availableWidth / sheetPx',
  'Math.min(1, Math.max(0.15, availableWidth / sheetPx))'
]) requireText(js, required, 'graph-reading-workbook.js');

// Page counter follows actual scrolling on the universal viewer.
for (const required of [
  'function updatePageFromBookScroll()',
  'function installBookScrollTracking()',
  "win.addEventListener('scroll'",
  'pageInput.value = String(page);',
  'requestAnimationFrame(updatePageFromBookScroll)'
]) requireText(js, required, 'graph-reading-workbook.js');

// Runtime workbook validation must reject a wrong page count.
requireText(js, 'pages.length !== manifest.pageCount', 'graph-reading-workbook.js');
const masterPageCount = (master.match(/class="[^"]*\ba4-page\b[^"]*"/g) || []).length;
if (masterPageCount !== meta.pageCount) {
  fail(`מאגר-מלא.html: ${masterPageCount} .a4-page elements, manifest expects ${meta.pageCount}`);
}

// Initial page-control metadata must agree with the manifest.
const inputMax = Number(index.match(/id="pageNumber"[^>]*max="(\d+)"/)?.[1]);
const initialPageCount = Number(index.match(/id="pageCount">(\d+)</)?.[1]);
if (inputMax !== meta.pageCount) fail(`index.html: pageNumber max=${inputMax}, manifest=${meta.pageCount}`);
if (initialPageCount !== meta.pageCount) fail(`index.html: pageCount=${initialPageCount}, manifest=${meta.pageCount}`);

// Release id is one value everywhere, including cache-busting references.
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
if (indexRelease) {
  requireText(index, `graph-reading-workbook.css?v=${indexRelease}`, 'index.html');
  requireText(index, `graph-reading-workbook.js?v=${indexRelease}`, 'index.html');
}

// PDF outputs must match the canonical manifest exactly.
for (const kind of ['color', 'bw']) {
  const file = meta.files?.[kind];
  if (!file?.path || !file?.sha256 || !Number.isInteger(file?.bytes)) {
    fail(`meta: invalid PDF contract for ${kind}`);
    continue;
  }
  const fullPath = join(root, file.path);
  if (!existsSync(fullPath)) {
    fail(`missing PDF output: ${file.path}`);
    continue;
  }
  const actualBytes = statSync(fullPath).size;
  if (actualBytes !== file.bytes) {
    fail(`${file.path}: bytes=${actualBytes}, manifest=${file.bytes}`);
  }
  const actualSha = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
  if (actualSha !== file.sha256) {
    fail(`${file.path}: sha256=${actualSha}, manifest=${file.sha256}`);
  }
}

// README preserves the rules for future agents/developers.
for (const required of [
  'מקור האמת היחיד',
  '`index.html` — נקודת הכניסה היחידה',
  '`מאגר-מלא.html` — מקור ה-HTML היחיד שמוצג בקורא בכל המכשירים',
  'אין תפריט "תצוגה"',
  'ה-PDF אינו מקור לתצוגה השוטפת',
  'מונה העמודים חייב לעקוב אחרי הגלילה בפועל בכל מכשיר',
  'אין ליצור מקור אמת נוסף'
]) requireText(readme, required, 'README.md');

if (failures.length) {
  console.error('\nViewer contract FAILED:\n');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Viewer contract OK: ${meta.pageCount} pages, one HTML viewer, PDFs verified by SHA-256.`);
