(() => {
  'use strict';

  const RELEASE_VERSION = 'graph-reading-20260902';
  const MANIFEST_URL = `meta/graph-reading-workbook.json?v=${RELEASE_VERSION}`;
  const params = new URLSearchParams(location.search);
  let manifest;
  let mode = params.get('mode') === 'bw' ? 'bw' : 'color';
  let page = Math.max(1, Number(params.get('page')) || 1);
  let zoom = params.get('zoom') || 'page-width';
  let loadTimer = null;

  const $ = (id) => document.getElementById(id);
  const frame = $('pdfFrame');
  const panel = $('viewerPanel');
  const status = $('status');
  const sourceBadge = $('sourceBadge');
  const label = $('viewerModeLabel');
  const pageInput = $('pageNumber');
  const pageCount = $('pageCount');
  const zoomSelect = $('zoomMode');
  const colorButton = $('colorMode');
  const bwButton = $('bwMode');
  const prevButton = $('prevPage');
  const nextButton = $('nextPage');
  const downloadButton = $('downloadButton');
  const openButton = $('openButton');
  const fallback = $('viewerFallback');
  const fallbackOpen = $('fallbackOpen');
  const fallbackDownload = $('fallbackDownload');

  function setStatus(text, state = 'ready') {
    status.textContent = text;
    status.classList.toggle('is-loading', state === 'loading');
    status.classList.toggle('is-error', state === 'error');
  }

  function clampPage(value) {
    const total = manifest?.pageCount || 156;
    return Math.min(total, Math.max(1, Number(value) || 1));
  }

  async function assertLocalPdf(path) {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`Local PDF HTTP ${response.status}`);
    if (type && !type.includes('application/pdf') && !path.endsWith('.pdf')) {
      throw new Error(`Unexpected content type: ${type}`);
    }
  }

  function versionedAssetUrl(file) {
    const separator = file.path.includes('?') ? '&' : '?';
    return `${file.path}${separator}v=${file.sha256.slice(0, 12)}-${RELEASE_VERSION}`;
  }

  function fragmentUrl(base) {
    const fragment = new URLSearchParams({ page: String(page), zoom });
    return `${base}#${fragment.toString()}`;
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    url.searchParams.set('page', String(page));
    url.searchParams.set('zoom', zoom);
    url.searchParams.set('release', RELEASE_VERSION);
    history.replaceState(null, '', url);
  }

  function syncControls(file) {
    const total = manifest.pageCount;
    page = clampPage(page);
    pageInput.value = String(page);
    pageInput.max = String(total);
    pageCount.textContent = String(total);
    prevButton.disabled = page === 1;
    nextButton.disabled = page === total;
    zoomSelect.value = [...zoomSelect.options].some((option) => option.value === zoom) ? zoom : 'page-width';
    label.textContent = file.label;
    colorButton.classList.toggle('is-active', mode === 'color');
    bwButton.classList.toggle('is-active', mode === 'bw');
    colorButton.setAttribute('aria-pressed', String(mode === 'color'));
    bwButton.setAttribute('aria-pressed', String(mode === 'bw'));
  }

  function showFallback(show) {
    fallback.hidden = !show;
    frame.hidden = show;
  }

  async function render({ verifySource = false } = {}) {
    const file = manifest.files[mode];
    syncControls(file);
    syncUrl();
    setStatus('טוען את החוברת המקומית…', 'loading');
    showFallback(false);

    const localUrl = versionedAssetUrl(file);
    const previewUrl = fragmentUrl(localUrl);

    try {
      if (verifySource) await assertLocalPdf(localUrl);

      sourceBadge.textContent = 'קובץ מקומי מהאתר';
      sourceBadge.classList.remove('is-fallback');
      frame.src = previewUrl;
      openButton.href = previewUrl;
      downloadButton.href = localUrl;
      downloadButton.setAttribute('download', file.filename);
      fallbackOpen.href = previewUrl;
      fallbackDownload.href = localUrl;
      fallbackDownload.setAttribute('download', file.filename);

      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        setStatus('התצוגה מתעכבת — אפשר לפתוח בטאב חדש', 'error');
        showFallback(true);
      }, 14000);
    } catch (error) {
      console.error('[graph-reading:local-pdf]', error);
      clearTimeout(loadTimer);
      sourceBadge.textContent = 'קובץ מקומי לא זמין';
      sourceBadge.classList.add('is-fallback');
      setStatus('קובץ החוברת המקומי לא נמצא', 'error');
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
    setStatus('מוכן לדפדוף');
    showFallback(false);
  });
  frame.addEventListener('error', () => {
    clearTimeout(loadTimer);
    setStatus('לא ניתן להציג בתוך החלון', 'error');
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
  zoomSelect.addEventListener('change', () => {
    zoom = zoomSelect.value;
    render();
  });
  $('fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await panel.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      window.open(openButton.href, '_blank', 'noopener,noreferrer');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches('input,select,textarea,[contenteditable="true"]')) return;
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
      console.error('[algebra-z]', error);
      setStatus('שגיאה בטעינת נתוני החוברת', 'error');
      sourceBadge.textContent = 'לא זמין';
      sourceBadge.classList.add('is-fallback');
      showFallback(true);
    }
  })();
})();
