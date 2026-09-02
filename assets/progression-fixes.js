(() => {
  'use strict';

  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pageNumber = page => Number(page.querySelector('.page-number')?.textContent.trim());
  const getPage = n => $$('.a4-page').find(page => pageNumber(page) === n);

  const style = document.createElement('style');
  style.textContent = `
    .frac-answer{
      display:inline-grid;
      grid-template-rows:auto 1.2px auto;
      align-items:center;
      justify-items:center;
      width:24mm;
      vertical-align:middle;
      direction:ltr;
      unicode-bidi:isolate;
      margin-inline:2mm;
    }
    .frac-answer::before{
      content:"";
      grid-row:2;
      width:100%;
      height:1.2px;
      background:#1f2a44;
    }
    .frac-answer .abox{
      width:19mm;
      height:25px;
      margin:1mm 0;
    }
    .early-reading .q-parts{gap:1.8mm}
    .early-reading .q-parts>li{gap:1.15mm}
    .early-reading .choices{gap:1.2mm 7mm}
    .early-reading .stmts{gap:1.35mm}
  `;
  document.head.appendChild(style);

  function groupTableAndGraph(page) {
    const q = page?.querySelector('.q');
    const table = q?.querySelector(':scope > .q-table');
    const graph = q?.querySelector(':scope > .q-graph');
    if (!table || !graph || q.querySelector(':scope > .visual-row')) return;
    const row = document.createElement('div');
    row.className = 'visual-row';
    table.before(row);
    row.append(graph, table);
  }

  function page7() {
    const page = getPage(7);
    if (!page) return;
    page.classList.add('page-redesigned', 'early-reading');
    groupTableAndGraph(page);
    const parts = page.querySelector('.q-parts');
    if (!parts) return;
    parts.innerHTML = `
      <li><div class="p-row p-row-inline"><span class="p-mark">א.</span><span class="p-text">איזה מספר בפתק נבחר על ידי מספר המבקרים הגדול ביותר?</span><span class="abox w-xs"></span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ב.</span><span class="p-text">כמה מבקרים בחרו במספר 3?</span><span class="abox w-xs"></span><span class="unit">מבקרים</span></div></li>
      <li>
        <div class="p-row"><span class="p-mark">ג.</span><span class="p-text">השוו בין מספר המבקרים שבחרו 1 לבין מספר המבקרים שבחרו 5.</span></div>
        <ul class="choices"><li><span class="box"></span><span>יותר בחרו 1</span></li><li><span class="box"></span><span>יותר בחרו 5</span></li><li><span class="box"></span><span>מספר שווה</span></li></ul>
      </li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ד.</span><span class="p-text">מה ההפרש בין מספר המבקרים שבחרו את התשובה השכיחה ביותר לבין מספר המבקרים שבחרו את התשובה הנדירה ביותר?</span><span class="abox w-xs"></span><span class="unit">מבקרים</span></div></li>`;
  }

  function page11() {
    const page = getPage(11);
    if (!page) return;
    page.classList.add('page-redesigned', 'early-reading');
    const parts = page.querySelector('.q-parts');
    if (!parts) return;
    parts.innerHTML = `
      <li><div class="p-row p-row-inline"><span class="p-mark">א.</span><span class="p-text">כמה חברים שיחקו ב־Fortnite?</span><span class="abox w-xs"></span><span class="unit">חברים</span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ב.</span><span class="p-text">כמה חברים שיחקו במשחק כלשהו בסך הכול?</span><span class="abox w-xs"></span><span class="unit">חברים</span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ג.</span><span class="p-text">מתוך 50 החברים שהיו מחוברים, איזה חלק שיחקו ב־Fortnite? כתבו את התשובה כשבר.</span><span class="frac-answer" aria-label="מקום לכתיבת שבר"><span class="abox"></span><span class="abox"></span></span></div></li>
      <li>
        <div class="p-row"><span class="p-mark">ד.</span><span class="p-text">סמנו נכון או לא נכון לפי הגרף.</span></div>
        <div class="stmts">
          <div class="stmt"><span class="stmt-text">יותר ממחצית החברים שהיו מחוברים שיחקו במשחק כלשהו.</span><span class="blank wide"></span></div>
          <div class="stmt"><span class="stmt-text">Fortnite היה המשחק ששיחקו בו הכי הרבה חברים.</span><span class="blank wide"></span></div>
        </div>
      </li>`;
  }

  function page12() {
    const page = getPage(12);
    if (!page) return;
    page.classList.add('page-redesigned', 'early-reading');
    const parts = page.querySelector('.q-parts');
    if (!parts) return;
    parts.innerHTML = `
      <li><div class="p-row p-row-inline"><span class="p-mark">א.</span><span class="p-text">כמה הסעות מתוארות בגרף בסך הכול?</span><span class="abox w-xs"></span><span class="unit">הסעות</span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ב.</span><span class="p-text">מה היה מספר הנוסעים השכיח ביותר בהסעה?</span><span class="abox w-xs"></span><span class="unit">נוסעים</span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ג.</span><span class="p-text">כמה הסעות יצאו עם 40 נוסעים או יותר?</span><span class="abox w-xs"></span><span class="unit">הסעות</span></div></li>
      <li>
        <div class="p-row"><span class="p-mark">ד.</span><span class="p-text">קבעו נכון או לא נכון.</span></div>
        <div class="stmts">
          <div class="stmt"><span class="stmt-text">הגרף מתאר בדיוק 15 הסעות.</span><span class="blank wide"></span></div>
          <div class="stmt"><span class="stmt-text">יש יותר מהסעה אחת שבה מספר הנוסעים שווה למספר הנוסעים השכיח.</span><span class="blank wide"></span></div>
        </div>
      </li>`;
  }

  function auditEarlyProbability() {
    $$('.a4-page').forEach(page => {
      const n = pageNumber(page);
      if (n > 20) return;
      if (/הסתברות/.test(page.textContent)) {
        // לא מסתירים תוכן בשקט: מסמנים מקרה שנשאר כדי שיהיה ניתן לזהותו בבדיקת QA חזותית.
        page.dataset.earlyProbabilityRemaining = 'true';
      }
    });
  }

  page7();
  page11();
  page12();
  auditEarlyProbability();
})();
