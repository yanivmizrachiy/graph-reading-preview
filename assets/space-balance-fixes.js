(() => {
  'use strict';

  const mmToPx = mm => mm * (96 / 25.4);

  function balance() {
    document.querySelectorAll('.a4-page').forEach(page => {
      const body = page.querySelector('.ws-body');
      if (!body) return;

      const children = Array.from(body.children).filter(el => el.offsetParent !== null);
      if (!children.length) return;

      const cs = getComputedStyle(body);
      const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0;
      const used = children.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
        + gap * Math.max(0, children.length - 1);
      const available = body.clientHeight;
      if (!available) return;

      const ratio = used / available;
      page.dataset.utilization = ratio.toFixed(2);

      if (ratio > 0.985) {
        page.classList.add('page-tight');
        return;
      }

      if (ratio >= 0.80) return;

      const workAreas = Array.from(page.querySelectorAll('.work,.ans'));
      if (!workAreas.length) return;

      const spare = Math.max(0, available - used - mmToPx(4));
      const extraEach = Math.min(spare / workAreas.length, mmToPx(24));
      if (extraEach < mmToPx(4)) return;

      workAreas.forEach(area => {
        const h = area.getBoundingClientRect().height;
        area.style.height = `${Math.round(h + extraEach)}px`;
      });
    });
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(balance));
  } else {
    requestAnimationFrame(balance);
  }
})();
