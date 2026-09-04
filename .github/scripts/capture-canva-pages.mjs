import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'student-summaries/weekly-2026-09-04';
const OUT_DIR = path.join(ROOT, 'assets');
const HTML_PATH = path.join(ROOT, 'index.html');

// Stable-snapshot strategy: capture Canva once, then serve only local assets.
// These are the public view links of the four one-page Canva copies.
// We freeze them into local PNGs so the published summary never depends on
// Canva iframe permissions, third-party cookies, CSP, expiring thumbnails,
// or an active Canva session on the student's phone.
const pages = [
  { url: 'https://www.canva.com/d/9R19LcpMITQtq_d', out: 'canva-page-1.png', label: 'דף Canva מקורי 1' },
  { url: 'https://www.canva.com/d/E2IOW4OQ4PF3Y5C', out: 'canva-page-2.png', label: 'דף Canva מקורי 2' },
  { url: 'https://www.canva.com/d/0a3n8zUEz9GUCUs', out: 'canva-page-3.png', label: 'דף Canva מקורי 3' },
  { url: 'https://www.canva.com/d/0mw482MUl4b7Wie', out: 'canva-page-4.png', label: 'דף Canva מקורי 4' },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function validPng(file) {
  if (!fs.existsSync(file)) return false;
  const b = fs.readFileSync(file);
  return b.length > 30_000 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

async function acceptCookies(page) {
  const patterns = [/accept all/i, /accept/i, /allow all/i, /agree/i, /אישור/i, /אפשר הכל/i, /מסכים/i, /קבל/i];
  for (const p of patterns) {
    try {
      const btn = page.getByRole('button', { name: p }).first();
      if (await btn.isVisible({ timeout: 700 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(800);
        return;
      }
    } catch {}
  }
}

async function findDesignBox(page) {
  return await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    const target = 794 / 1123;
    let best = null;
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 280 || r.height < 380) continue;
      if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const ratio = r.width / r.height;
      const delta = Math.abs(ratio - target);
      if (delta > 0.09) continue;
      const area = r.width * r.height;
      const tag = el.tagName.toLowerCase();
      const meta = `${tag} ${el.id || ''} ${el.className || ''} ${el.getAttribute('data-testid') || ''}`.toLowerCase();
      let bonus = 0;
      if (/canvas|page|design|artboard|preview/.test(meta)) bonus += 300000;
      if (tag === 'canvas' || tag === 'svg' || tag === 'img') bonus += 200000;
      const score = area + bonus - delta * 1_000_000;
      if (!best || score > best.score) best = { x:r.x, y:r.y, width:r.width, height:r.height, score, meta };
    }
    return best;
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1200, height: 1700 },
  deviceScaleFactor: 2,
  locale: 'he-IL',
  colorScheme: 'light',
});

try {
  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    console.log(`Opening Canva page ${i + 1}: ${item.url}`);
    await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(5000);
    await acceptCookies(page);
    await page.waitForTimeout(7000);

    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 5000);
    if (/request access|you don't have permission|אין לך הרשאה|בקשת גישה|sign in to continue/i.test(bodyText)) {
      throw new Error(`Canva page ${i + 1} is not publicly viewable. URL: ${item.url}`);
    }

    const box = await findDesignBox(page);
    if (!box) {
      await page.screenshot({ path: path.join(OUT_DIR, `debug-canva-${i + 1}.png`), fullPage: true });
      throw new Error(`Could not identify A4 design surface on Canva page ${i + 1}`);
    }

    console.log(`Page ${i + 1} design box`, box);
    const clip = {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, 1200 - Math.max(0, box.x)),
      height: Math.min(box.height, 1700 - Math.max(0, box.y)),
    };
    const outPath = path.join(OUT_DIR, item.out);
    await page.screenshot({ path: outPath, clip, animations: 'disabled' });
    if (!validPng(outPath)) throw new Error(`Invalid/too-small PNG for Canva page ${i + 1}`);
    await page.close();
  }
} finally {
  await browser.close();
}

let html = fs.readFileSync(HTML_PATH, 'utf8');
const replacementBlocks = pages.map((item, i) => `\n<article class="sheet canva-a4" aria-label="${item.label}">\n  <div class="canva-frame">\n    <a href="${item.url}" target="_blank" rel="noopener" aria-label="פתח את ${item.label} בקנבה">\n      <img class="canva-static" src="assets/${item.out}" alt="${item.label}" loading="lazy" decoding="async">\n    </a>\n  </div>\n</article>`);

let idx = 0;
html = html.replace(/<article class="sheet canva-a4"[\s\S]*?<\/article>/g, () => replacementBlocks[idx++] || '');
if (idx < 4) throw new Error(`Expected 4 Canva article blocks in ${HTML_PATH}, found ${idx}`);
fs.writeFileSync(HTML_PATH, html);
console.log('Captured all 4 Canva pages and rewired the summary to local immutable PNG files.');
