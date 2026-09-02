(() => {
  'use strict';

  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pageNumber = page => Number(page.querySelector('.page-number')?.textContent.trim());
  const getPage = n => $$('.a4-page').find(page => pageNumber(page) === n);

  const style = document.createElement('style');
  style.textContent = `
    .math-num{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}
    .frac{display:inline-grid;grid-template-rows:auto auto;vertical-align:-.42em;line-height:1;text-align:center;min-width:1.35em;margin:0 .08em;direction:ltr;unicode-bidi:isolate}
    .frac .num{border-bottom:1.25px solid currentColor;padding:0 .12em .08em}
    .frac .den{padding:.08em .12em 0}

    .q-graph.graph-compact{width:64%;max-width:116mm;margin-inline:auto}
    .q-graph.graph-medium{width:80%;max-width:146mm;margin-inline:auto}

    .visual-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(42mm,.65fr);gap:5mm;align-items:center;width:100%;direction:rtl}
    .visual-row .q-graph{width:100%;max-width:none;margin:0}
    .visual-row .q-table{margin:0;justify-self:center;align-self:center;max-width:100%}
    .visual-row .q-table th,.visual-row .q-table td{padding:1.35mm 2.2mm}

    .sentence-completion{display:flex;align-items:center;gap:2mm;flex-wrap:nowrap}
    .sentence-completion .p-text{flex:0 1 auto;min-width:0}
    .sentence-completion .abox,.sentence-completion .blank,.sentence-completion .unit{flex:none}
    .sentence-completion .ans-lbl{display:none}

    .page-redesigned .q-parts{gap:2mm}
    .page-redesigned .q-parts>li{gap:1.25mm}
    .page-redesigned .stmts{gap:1.35mm}
    .page-redesigned .choices{gap:1.2mm 6mm}

    .page-6-flow .q-parts>li{padding:1.4mm 0;border-bottom:.25mm solid #e2e8f0}
    .page-6-flow .q-parts>li:last-child{border-bottom:0}
    .page-6-flow .p-row{align-items:flex-start}
    .page-6-flow .p-answer{padding-inline-start:7.6mm;margin-top:1mm}

    .page-tight .ws-body{gap:3.6mm}
    .page-tight .q{gap:2mm}
    .page-tight .q-parts{gap:1.7mm}
    .page-tight .q-parts>li{gap:1.1mm}
  `;
  document.head.appendChild(style);

  function normalizeNegativeNumbers() {
    $$('td, th').forEach(cell => {
      const raw = cell.textContent.trim();
      let m = raw.match(/^(\d+(?:\.\d+)?)-$/);
      if (m) {
        cell.innerHTML = `<bdi class="math-num" dir="ltr">−${m[1]}</bdi>`;
        return;
      }
      m = raw.match(/^-\s*(\d+(?:\.\d+)?)$/);
      if (m) cell.innerHTML = `<bdi class="math-num" dir="ltr">−${m[1]}</bdi>`;
    });

    $$('svg text').forEach(el => {
      const raw = el.textContent.trim();
      let m = raw.match(/^(\d+(?:\.\d+)?)-$/);
      if (m) {
        el.textContent = `−${m[1]}`;
        el.style.direction = 'ltr';
        return;
      }
      m = raw.match(/^-\s*(\d+(?:\.\d+)?)$/);
      if (m) {
        el.textContent = `−${m[1]}`;
        el.style.direction = 'ltr';
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || parent.closest('svg,script,style')) return;
      const t = node.nodeValue;
      const next = t
        .replace(/(^|[\s(=,:;])-(\d+(?:\.\d+)?)(?=$|[\s),.;])/g, '$1−$2')
        .replace(/(^|[\s(=,:;])(\d+(?:\.\d+)?)-(?=$|[\s),.;])/g, '$1−$2');
      if (next !== t) node.nodeValue = next;
    });
  }

  function replaceFractions() {
    const selector = '.choices span, .p-text, .q-stem, .q-note, td, th';
    $$(selector).forEach(root => {
      if (root.closest('svg') || root.querySelector('.frac')) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const text = node.nodeValue;
        if (!/(^|[^\d])(\d{1,3})\/(\d{1,3})(?!\d)/.test(text)) return;
        const frag = document.createDocumentFragment();
        let last = 0;
        const re = /(^|[^\d])(\d{1,3})\/(\d{1,3})(?!\d)/g;
        let match;
        while ((match = re.exec(text))) {
          const prefixLen = match[1].length;
          const start = match.index + prefixLen;
          if (start > last) frag.append(document.createTextNode(text.slice(last, start)));
          const frac = document.createElement('span');
          frac.className = 'frac';
          frac.setAttribute('aria-label', `${match[2]} חלקי ${match[3]}`);
          frac.innerHTML = `<span class="num">${match[2]}</span><span class="den">${match[3]}</span>`;
          frag.append(frac);
          last = match.index + match[0].length;
        }
        if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      });
    });
  }

  function adaptiveGraphSizing() {
    $$('.q-graph').forEach(graph => {
      const svg = graph.querySelector('svg');
      if (!svg) return;
      const series = $$('polyline', svg).filter(line => {
        const pts = (line.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean);
        return pts.length >= 2;
      });
      if (!series.length) return;
      const counts = series.map(line => (line.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).length);
      const maxPoints = Math.max(...counts);
      if (series.length === 1 && maxPoints <= 5) graph.classList.add('graph-compact');
      else if (series.length <= 2 && maxPoints <= 6) graph.classList.add('graph-medium');
    });
  }

  function normalizeInlineCompletions() {
    $$('.p-row-inline').forEach(row => {
      const text = row.textContent.replace(/\s+/g, ' ').trim();
      if (!row.querySelector('.abox,.blank')) return;
      if (/השלימו|בקצב של|מייצג|גדל ב-|קטן ב-/.test(text)) row.classList.add('sentence-completion');
    });
  }

  function groupTableAndGraph(page, force = false) {
    if (!page) return;
    const q = page.querySelector('.q');
    const table = q?.querySelector(':scope > .q-table');
    const graph = q?.querySelector(':scope > .q-graph');
    if (!table || !graph) return;
    if (!force && table.rows.length > 10) return;
    const row = document.createElement('div');
    row.className = 'visual-row';
    table.before(row);
    row.append(graph, table);
  }

  function moveInlineAnswerBelow(li) {
    const row = li.querySelector(':scope > .p-row');
    if (!row || !row.classList.contains('p-row-inline')) return;
    const answerNodes = Array.from(row.children).filter(el =>
      el.matches('.ans-lbl,.abox,.unit,.wexpr')
    );
    if (!answerNodes.length) return;
    row.classList.remove('p-row-inline', 'sentence-completion');
    const answer = document.createElement('div');
    answer.className = 'p-answer';
    answerNodes.forEach(node => answer.append(node));
    row.after(answer);
  }

  function redesignPage3() {
    const page = getPage(3);
    if (!page) return;
    page.classList.add('page-redesigned');
    const parts = page.querySelector('.q-parts');
    if (!parts) return;
    const probability = Array.from(parts.children).find(li => li.textContent.includes('הסתברות'));
    if (probability) {
      probability.innerHTML = `
        <div class="p-row p-row-inline">
          <span class="p-mark">ג.</span>
          <span class="p-text">איזה אמצעי תחבורה נבחר על ידי האחוז הגדול ביותר של התלמידים?</span>
          <span class="abox w-m"></span>
        </div>`;
    }
    if (!Array.from(parts.children).some(li => li.dataset.addedComparison === '1')) {
      const li = document.createElement('li');
      li.dataset.addedComparison = '1';
      li.innerHTML = `
        <div class="p-row"><span class="p-mark">ד.</span><span class="p-text">בחרו שני אמצעי תחבורה מן הגרף וכתבו משפט אחד שמשווה ביניהם על סמך הנתונים.</span></div>
        <div class="work work-2"></div>`;
      parts.append(li);
    }
    page.querySelector('.q-graph')?.classList.add('graph-medium');
  }

  function redesignPage4And5() {
    [4, 5].forEach(n => {
      const page = getPage(n);
      if (!page) return;
      page.classList.add('page-redesigned');
      groupTableAndGraph(page, true);
    });
  }

  function redesignPage6() {
    const page = getPage(6);
    if (!page) return;
    page.classList.add('page-redesigned', 'page-6-flow');
    const stem = page.querySelector('.q-stem');
    if (stem) stem.textContent = 'עיינו בגרף וענו על הסעיפים הבאים.';
    const parts = page.querySelector('.q-parts');
    if (parts) Array.from(parts.children).forEach(moveInlineAnswerBelow);
    page.querySelector('.q-graph')?.classList.add('graph-medium');
  }

  function redesignPage14() {
    const page = getPage(14);
    if (!page) return;
    page.classList.add('page-redesigned');
    const row = $$('.p-row-inline', page).find(r => /בקצב של/.test(r.textContent));
    if (!row) return;
    const mark = row.querySelector('.p-mark')?.textContent || 'ב.';
    row.classList.add('sentence-completion');
    row.innerHTML = `
      <span class="p-mark">${mark}</span>
      <span class="p-text">השלימו: רוקנו את המים מהמכל בקצב של</span>
      <span class="abox w-xs" aria-label="מקום לתשובה"></span>
      <span class="unit">מ״ק בדקה.</span>`;
  }

  function redesignPage27() {
    const page = getPage(27);
    if (!page) return;
    page.classList.add('page-redesigned');
    const q = page.querySelector('.q');
    if (!q) return;
    groupTableAndGraph(page, true);
    q.querySelector('.q-graph')?.classList.add('graph-compact');
    const parts = q.querySelector('.q-parts');
    if (!parts) return;
    parts.innerHTML = `
      <li><div class="p-row"><span class="p-mark">א.</span><span class="p-text">השלימו את הטבלה לפי הנתונים שבגרף.</span></div></li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ב.</span><span class="p-text">כמה משלמים עבור 2 ק״ג של משקל עודף?</span><span class="abox w-xs"></span><span class="unit">₪</span></div></li>
      <li>
        <div class="p-row"><span class="p-mark">ג.</span><span class="p-text">קבעו לגבי כל היגד אם הוא נכון או לא נכון.</span></div>
        <div class="stmts">
          <div class="stmt"><span class="stmt-text">על כל ק״ג נוסף התשלום גדל באותו סכום.</span><span class="blank wide"></span></div>
          <div class="stmt"><span class="stmt-text">התשלום עבור 2 ק״ג הוא פי שניים מהתשלום עבור 1 ק״ג.</span><span class="blank wide"></span></div>
          <div class="stmt"><span class="stmt-text">כאשר אין משקל עודף, אין תשלום נוסף.</span><span class="blank wide"></span></div>
        </div>
      </li>
      <li>
        <div class="p-row"><span class="p-mark">ד.</span><span class="p-text">איזה משפט מתאר נכון את הקשר בין המשקל העודף לתשלום?</span></div>
        <ul class="choices">
          <li><span class="box"></span><span>כל ק״ג נוסף מגדיל את התשלום ב־30 ₪.</span></li>
          <li><span class="box"></span><span>התשלום קבוע ואינו תלוי במשקל.</span></li>
          <li><span class="box"></span><span>כל ק״ג נוסף מגדיל את התשלום ב־10 ₪.</span></li>
          <li><span class="box"></span><span>רק הקילוגרם הראשון מחויב בתשלום.</span></li>
        </ul>
      </li>
      <li><div class="p-row p-row-inline"><span class="p-mark">ה.</span><span class="p-text">בהנחה שהתשלום יחסי גם לחלקי ק״ג, כמה ישלמו עבור 1.5 ק״ג משקל עודף?</span><span class="abox w-xs"></span><span class="unit">₪</span></div></li>`;
  }

  function fitOverflowingPages() {
    requestAnimationFrame(() => {
      $$('.a4-page').forEach(page => {
        const body = page.querySelector('.ws-body');
        if (body && body.scrollHeight > body.clientHeight + 2) page.classList.add('page-tight');
      });
    });
  }

  normalizeNegativeNumbers();
  replaceFractions();
  adaptiveGraphSizing();
  normalizeInlineCompletions();
  redesignPage3();
  redesignPage4And5();
  redesignPage6();
  redesignPage14();
  redesignPage27();
  fitOverflowingPages();
})();
