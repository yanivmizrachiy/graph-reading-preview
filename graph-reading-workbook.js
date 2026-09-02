(() => {
  'use strict';

  const RELEASE_VERSION = 'graph-reading-20260902-clean-viewer';
  const MANIFEST_URL = `meta/graph-reading-workbook.json?v=${RELEASE_VERSION}`;
  const params = new URLSearchParams(location.search);

  let manifest;
  let mode = params.get('mode') === 'bw' ? 'bw' : 'color';
  let page = Math.max(1, Number(params.get('page')) || 1);
  let loadTimer = null;

  const $ = (id) => document.getElementById(id);
  const frame = $('pdfFrame');
  const panel = $('viewerPanel');
  const pageInput = $('pageNumber');
  const pageCount = $('pageCount');
  const colorButton = $('colorMode');
  const bwButton = $('bwMode');
  const prevButton = $('prevPage');
  const nextButton = $('nextPage');
  const downloadButton = $('downloadButton');
  const openButton = $('openButton');
  const fallback = $('viewerFallback');
  const fallbackOpen = $('fallbackOpen');
  const fallbackDownload = $('fallbackDownload');

  function clampPage(value) {
    const total = manifest?.pageCount || 165;
    return Math.min(total, Math.max(1, Number(value) || 1));
  }

  async function assertLocalPdf(path) {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) throw new Error(`Local PDF HTTP ${response.status}`);
  }

  function versionedAssetUrl(file) {
    const separator = file.path.includes('?') ? '&' : '?';
    return `${file.path}${separator}v=${file.sha256.slice(0, 12)}-${RELEASE_VERSION}`;
  }

  function fragmentUrl(base) {
    return `${base}#toolbar=0&navpanes=0&scrollbar=0&page=${page}&zoom=page-width`;
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    url.searchParams.set('page', String(page));
    url.searchParams.set('release', RELEASE_VERSION);
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
    colorButton.classList.toggle('is-active', mode === 'color');
    bwButton.classList.toggle('is-active', mode === 'bw');
    colorButton.setAttribute('aria-pressed', String(mode === 'color'));
    bwButton.setAttribute('aria-pressed', String(mode === 'bw'));
  }

  function showFallback(show) {
    fallback.hidden = !show;
    frame.hidden = show;
  }

  const usesHtmlBook = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const BOOK_HTML = 'מאגר-מלא.html';
  let bookReady = false;

  function bookDoc() {
    try { return frame.contentDocument; } catch { return null; }
  }

  function applyMobileBookLayout() {
    const doc = bookDoc();
    if (!doc || !doc.head) return;

    let style = doc.getElementById('gzMobileContinuousPages');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'gzMobileContinuousPages';
      style.textContent = `
        html, body { background: #fff !important; }
        body { gap: 0 !important; }
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
  }

  function fitBook() {
    const doc = bookDoc();
    if (!doc || !doc.documentElement) return;
    const sheetPx = 210 * (96 / 25.4);
    const availableWidth = frame.clientWidth || sheetPx;
    const scale = Math.max(0.15, availableWidth / sheetPx);
    doc.documentElement.style.zoom = String(scale);
  }

  function showBookPage() {
    const doc = bookDoc();
    if (!doc) return;
    const sheets = doc.querySelectorAll('.a4-page');
    const target = sheets[clampPage(page) - 1];
    if (target) target.scrollIntoView({ block: 'start' });
  }

  function applyBookMode() {
    const doc = bookDoc();
    if (!doc) return;
    let link = doc.getElementById('gzBwSheet');

    if (mode === 'bw') {
      if (!link) {
        link = doc.createElement('link');
        link.id = 'gzBwSheet';
        link.rel = 'stylesheet';
        link.href = 'assets/worksheet-bw.css';
        doc.head.appendChild(link);
      }
      for (const img of doc.images) {
        if (!img.dataset.colorSrc) img.dataset.colorSrc = img.getAttribute('src');
        img.setAttribute('src', img.dataset.colorSrc.replace(
          /assets\/images\/([^/]+)$/, (match, filename) =>
            `assets/images/bw/${filename.replace(/\.[^.]+$/, '.jpg')}`
        ));
      }
    } else {
      if (link) link.remove();
      for (const img of doc.images) {
        if (img.dataset.colorSrc) img.setAttribute('src', img.dataset.colorSrc);
      }
    }
  }

  function configureFileLinks(file, openHref) {
    const downloadHref = versionedAssetUrl(file);
    downloadButton.href = downloadHref;
    downloadButton.setAttribute('download', file.filename);
    openButton.href = openHref;
    fallbackOpen.href = openHref;
    fallbackDownload.href = downloadHref;
    fallbackDownload.setAttribute('download', file.filename);
  }

  function renderHtmlBook(file) {
    syncControls();
    syncUrl();
    configureFileLinks(file, versionedAssetUrl(file));
    showFallback(false);

    if (!bookReady) {
      frame.src = BOOK_HTML;
      return;
    }

    applyMobileBookLayout();
    applyBookMode();
    fitBook();
    showBookPage();
  }

  async function render({ verifySource = false } = {}) {
    const file = manifest.files[mode];

    if (usesHtmlBook) {
      renderHtmlBook(file);
      return;
    }

    syncControls();
    syncUrl();
    showFallback(false);

    const localUrl = versionedAssetUrl(file);
    const previewUrl = fragmentUrl(localUrl);

    try {
      if (verifySource) await assertLocalPdf(localUrl);
      frame.src = previewUrl;
      configureFileLinks(file, previewUrl);

      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => showFallback(true), 14000);
    } catch (error) {
      console.error('[graph-reading:local-pdf]', error);
      clearTimeout(loadTimer);
      showFallback(true);
    }
  }

  function setPage(next) {
    const normalized = clampPage(next);
    if (normalized === page) return;
    page = normalized;
    render();
  }

  function setMode(next) {
    if (!manifest.files[next] || next === mode) return;
    mode = next;
    page = 1;
    render({ verifySource: true });
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
    clearTimeout(loadTimer);
    if (usesHtmlBook) {
      bookReady = true;
      applyMobileBookLayout();
      applyBookMode();
      fitBook();
      showBookPage();
    }
    showFallback(false);
  });

  frame.addEventListener('error', () => {
    clearTimeout(loadTimer);
    showFallback(true);
  });

  colorButton.addEventListener('click', () => setMode('color'));
  bwButton.addEventListener('click', () => setMode('bw'));
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

  $('fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await panel.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      window.open(openButton.href, '_blank', 'noopener,noreferrer');
    }
  });

  window.addEventListener('resize', () => {
    if (usesHtmlBook && bookReady) fitBook();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (usesHtmlBook && bookReady) {
        fitBook();
        showBookPage();
      }
    }, 250);
  });

  document.addEventListener('keydown', (event) => {
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
      await render({ verifySource: true });
    } catch (error) {
      console.error('[graph-reading]', error);
      showFallback(true);
    }
  })();
})();
