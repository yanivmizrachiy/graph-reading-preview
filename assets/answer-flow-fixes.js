(() => {
  'use strict';

  const rows = Array.from(document.querySelectorAll('.p-row-inline'));

  rows.forEach(row => {
    if (row.classList.contains('sentence-completion')) return;
    if (row.closest('.choices,.stmt')) return;

    const direct = Array.from(row.children);
    const answerWidgets = direct.filter(el =>
      el.matches('.ans-lbl,.abox,.wexpr,.unit,.frac-answer')
    );

    const hasAnswer = answerWidgets.some(el =>
      el.matches('.abox,.wexpr,.frac-answer') || el.querySelector?.('.abox')
    );
    if (!hasAnswer) return;

    row.classList.remove('p-row-inline');

    let answer = row.nextElementSibling;
    if (!answer || !answer.classList.contains('p-answer')) {
      answer = document.createElement('div');
      answer.className = 'p-answer';
      row.after(answer);
    }

    if (!answerWidgets.some(el => el.classList.contains('ans-lbl')) && !answer.querySelector('.ans-lbl')) {
      const label = document.createElement('span');
      label.className = 'ans-lbl';
      label.textContent = 'תשובה:';
      answer.append(label);
    }

    answerWidgets.forEach(el => answer.append(el));
  });
})();
