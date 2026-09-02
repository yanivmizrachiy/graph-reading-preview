(() => {
  'use strict';
  const pages = Array.from(document.querySelectorAll('.a4-page'));
  const page13 = pages.find(page => Number(page.querySelector('.page-number')?.textContent.trim()) === 13);
  if (!page13) return;

  const probabilityItem = Array.from(page13.querySelectorAll('.q-parts > li'))
    .find(li => li.textContent.includes('הסתברות'));

  if (probabilityItem) {
    const mark = probabilityItem.querySelector('.p-mark')?.textContent || 'ג.';
    probabilityItem.innerHTML = `
      <div class="p-row p-row-inline">
        <span class="p-mark">${mark}</span>
        <span class="p-text">כמה קורקינטים במלאי הם בעלי טווח נסיעה הגדול מ־35 ק״מ?</span>
        <span class="abox w-xs"></span>
        <span class="unit">קורקינטים</span>
      </div>`;
  }
})();
