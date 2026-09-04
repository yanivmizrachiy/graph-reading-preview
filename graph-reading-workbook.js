(() => {
  'use strict';

  const RELEASE_VERSION = 'graph-reading-20260904-cover-first';
  const MANIFEST_URL = `meta/graph-reading-workbook.json?v=${RELEASE_VERSION}`;
  const BOOK_HTML = `מאגר-מלא.html?v=${RELEASE_VERSION}`;
  const EMBEDDED_VIEWER = window.self !== window.top;
  document.documentElement.classList.toggle('embedded-viewer', EMBEDDED_VIEWER);

  let manifest;
  let page = 1;
  let bookReady = false;
  let scrollRaf = null;

  const $ = (id) => document.getElementById(id);
  const frame = $('bookFrame');
  const panel = $('viewerPanel');
  const pageInput = $('pageNumber');
  const pageCount = $('pageCount');
  const prevButton = $('prevPage');
  const nextButton = $('nextPage');
  const downloadButton = $('downloadButton');
  const fallback = $('viewerFallback');
  const fallbackDownload = $('fallbackDownload');
  const printButton = $('printButton');
  const printMenu = $('printMenu');
  const printColor = $('printColor');
  const printBw = $('printBw');

  if (EMBEDDED_VIEWER) frame.setAttribute('scrolling', 'no');

  function clampPage(value) {
    const total = manifest?.pageCount || 165;
    return Math.min(total, Math.max(1, Number(value) || 1));
  }

  function versionedAssetUrl(file) {
    const separator = file.path.includes('?') ? '&' : '?';
    return `${file.path}${separator}v=${file.sha256.slice(0, 12)}-${RELEASE_VERSION}`;
  }

  function printUrl(file) {
    return `${versionedAssetUrl(file)}#toolbar=1&navpanes=0&page=${page}&zoom=page-width`;
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('page', String(page));
    url.searchParams.set('release', RELEASE_VERSION);
    url.searchParams.delete('mode');
    url.searchParams.delete('zoom');
    history.replaceState(null, '', url);
  }

  function syncControls() {
    const total = manifest.pageCount;
    page = clampPage(page);
    pageInput.value = String(page);
    pageInput.max = String(total);
    pageCount.textContent = String(total);
    prevButton.disabled = page === 1;
    nextButton.disabled = page === total;
  }

  function showFallback(show) {
    fallback.hidden = !show;
    frame.hidden = show;
  }

  function setPrintMenu(open) {
    printMenu.hidden = !open;
    printButton.setAttribute('aria-expanded', String(open));
  }

  function openPrintVersion(kind) {
    if (!manifest?.files?.[kind]) return;
    setPrintMenu(false);
    window.open(printUrl(manifest.files[kind]), '_blank', 'noopener,noreferrer');
  }

  function bookDoc() {
    try { return frame.contentDocument; } catch { return null; }
  }

  function bookWindow() {
    try { return frame.contentWindow; } catch { return null; }
  }

  function bookPages() {
    const doc = bookDoc();
    return doc ? [...doc.querySelectorAll('.a4-page')] : [];
  }

  function validateBook() {
    const doc = bookDoc();
    const pages = bookPages();
    if (!doc?.head || pages.length !== manifest.pageCount) {
      console.error('[graph-reading:book-contract]', {
        expectedPages: manifest.pageCount,
        actualPages: pages.length
      });
      bookReady = false;
      showFallback(true);
      return false;
    }
    return true;
  }

  function applyBookLayout() {
    const doc = bookDoc();
    if (!doc?.head) return;

    let style = doc.getElementById('gzContinuousPages');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'gzContinuousPages';
      style.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          scrollbar-color: #d6aa32 #0f2747;
          scrollbar-width: thin;
        }
        html::-webkit-scrollbar { width: 10px; }
        html::-webkit-scrollbar-track { background: #0f2747; }
        html::-webkit-scrollbar-thumb {
          border: 2px solid #0f2747;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffe98b, #d6aa32);
        }
        body { gap: 0 !important; }
        body.gr-embedded-book { overflow: hidden !important; }
        body.gr-embedded-book .a4-page { display: none !important; }
        body.gr-embedded-book .a4-page.gr-current-page { display: flex !important; }
        .a4-page {
          margin: 0 auto !important;
          box-shadow: none !important;
        }
        .a4-page + .a4-page {
          border-top: 3px solid #0f2747 !important;
        }
      `;
      doc.head.appendChild(style);
    }
    doc.body?.classList.toggle('gr-embedded-book', EMBEDDED_VIEWER);
  }

  function fitBook() {
    const doc = bookDoc();
    if (!doc?.documentElement) return;
    const sheetPx = 210 * (96 / 25.4);
    const sheetHeightPx = 297 * (96 / 25.4);
    const availableWidth = frame.clientWidth || sheetPx;
    const availableHeight = frame.clientHeight || sheetHeightPx;
    const widthScale = availableWidth / sheetPx;
    const heightScale = EMBEDDED_VIEWER ? availableHeight / sheetHeightPx : 1;
    const scale = Math.min(1, Math.max(0.15, widthScale), Math.max(0.15, heightScale));
    doc.documentElement.style.zoom = String(scale);
  }

  function showBookPage() {
    const pages = bookPages();
    const targetIndex = clampPage(page) - 1;
    const target = pages[targetIndex];
    if (!target) return;

    if (EMBEDDED_VIEWER) {
      pages.forEach((sheet, index) => sheet.classList.toggle('gr-current-page', index === targetIndex));
      bookWindow()?.scrollTo(0, 0);
      return;
    }

    pages.forEach((sheet) => sheet.classList.remove('gr-current-page'));
    target.scrollIntoView({ block: 'start' });
  }

  function updatePageFromBookScroll() {
    if (EMBEDDED_VIEWER) return;
    const win = bookWindow();
    const pages = bookPages();
    if (!win || !pages.length) return;

    const marker = Math.max(1, win.innerHeight * 0.35);
    let bestIndex = 0;
    let bestDistance = Infinity;

    pages.forEach((sheet, index) => {
      const rect = sheet.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) {
        bestIndex = index;
        bestDistance = -1;
        return;
      }
      if (bestDistance < 0) return;
      const distance = Math.abs((rect.top + rect.bottom) / 2 - marker);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const visiblePage = bestIndex + 1;
    if (visiblePage !== page) {
      page = visiblePage;
      syncControls();
      syncUrl();
    }
  }

  function installBookScrollTracking() {
    if (EMBEDDED_VIEWER) return;
    const win = bookWindow();
    if (!win || win.__graphReadingPageTracking) return;
    win.__graphReadingPageTracking = true;

    win.addEventListener('scroll', () => {
      if (scrollRaf !== null) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        updatePageFromBookScroll();
      });
    }, { passive: true });
  }

  function installEmbeddedPaging() {
    if (!EMBEDDED_VIEWER) return;
    const win = bookWindow();
    if (!win || win.__graphReadingEmbeddedPaging) return;
    win.__graphReadingEmbeddedPaging = true;

    let wheelTotal = 0;
    let wheelReset = null;
    let touchStartY = null;

    win.addEventListener('wheel', (event) => {
      event.preventDefault();
      wheelTotal += event.deltaY;
      clearTimeout(wheelReset);
      wheelReset = setTimeout(() => { wheelTotal = 0; }, 160);
      if (Math.abs(wheelTotal) < 36) return;
      const direction = wheelTotal > 0 ? 1 : -1;
      wheelTotal = 0;
      setPage(page + direction);
    }, { passive: false });

    win.addEventListener('touchstart', (event) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    }, { passive: true });

    win.addEventListener('touchend', (event) => {
      if (touchStartY === null) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const distance = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(distance) < 42) return;
      setPage(page + (distance > 0 ? 1 : -1));
    }, { passive: true });
  }

  function configureDownload() {
    const file = manifest.files.color;
    const href = versionedAssetUrl(file);
    downloadButton.href = href;
    downloadButton.setAttribute('download', file.filename);
    fallbackDownload.href = href;
    fallbackDownload.setAttribute('download', file.filename);
  }

  function renderBook() {
    syncControls();
    syncUrl();
    configureDownload();
    showFallback(false);

    if (!bookReady) {
      if (frame.getAttribute('src') !== BOOK_HTML) frame.src = BOOK_HTML;
      return;
    }

    if (!validateBook()) return;
    applyBookLayout();
    fitBook();
    showBookPage();
    installBookScrollTracking();
    installEmbeddedPaging();
  }

  function setPage(next) {
    const normalized = clampPage(next);
    if (normalized === page) return;
    page = normalized;
    syncControls();
    syncUrl();
    if (bookReady) showBookPage();
  }

  async function loadManifest() {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    const data = await response.json();
    if (!Number.isInteger(data.pageCount) || data.pageCount < 1) throw new Error('Manifest contract failed');
    if (!data.files?.color || !data.files?.bw) throw new Error('Manifest contract failed');
    return data;
  }

  frame.addEventListener('load', () => {
    bookReady = true;
    if (!manifest || !validateBook()) return;
    applyBookLayout();
    fitBook();
    showBookPage();
    installBookScrollTracking();
    installEmbeddedPaging();
    requestAnimationFrame(updatePageFromBookScroll);
    showFallback(false);
  });

  frame.addEventListener('error', () => {
    bookReady = false;
    showFallback(true);
  });

  prevButton.addEventListener('click', () => setPage(page - 1));
  nextButton.addEventListener('click', () => setPage(page + 1));
  pageInput.addEventListener('change', () => setPage(pageInput.value));
  pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setPage(pageInput.value);
      pageInput.blur();
    }
  });

  printButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setPrintMenu(printMenu.hidden);
  });
  printMenu.addEventListener('click', (event) => event.stopPropagation());
  printColor.addEventListener('click', () => openPrintVersion('color'));
  printBw.addEventListener('click', () => openPrintVersion('bw'));
  document.addEventListener('click', () => setPrintMenu(false));

  $('fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await panel.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      window.open(downloadButton.href, '_blank', 'noopener,noreferrer');
    }
  });

  window.addEventListener('resize', () => {
    if (!bookReady) return;
    fitBook();
    requestAnimationFrame(updatePageFromBookScroll);
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (!bookReady) return;
      fitBook();
      showBookPage();
      updatePageFromBookScroll();
    }, 250);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setPrintMenu(false);
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches('input,textarea,[contenteditable="true"]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'PageDown') setPage(page + 1);
    if (event.key === 'ArrowRight' || event.key === 'PageUp') setPage(page - 1);
    if (event.key === 'Home') setPage(1);
    if (event.key === 'End') setPage(manifest.pageCount);
  });

  (async () => {
    try {
      manifest = await loadManifest();
      page = clampPage(page);
      renderBook();
    } catch (error) {
      console.error('[graph-reading]', error);
      showFallback(true);
    }
  })();
})();
