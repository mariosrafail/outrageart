// zoom.js — simple, snappy pan & zoom for #viewerImg inside #viewer
(function(){
  const viewer = document.getElementById('viewer');
  const img = document.getElementById('viewerImg');
  if (!viewer || !img) return;

  let scale = 1;
  const minScale = 1;
  const maxScale = 6;
  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0;
  let panning = false;

  function setTransform() {
    img.style.transform = `translate(${lastX}px, ${lastY}px) scale(${scale})`;
  }

  function clampPan() {
    const rect = viewer.getBoundingClientRect();
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const sw = iw * scale;
    const sh = ih * scale;
    const limitX = Math.max(0, (sw - rect.width) / 2);
    const limitY = Math.max(0, (sh - rect.height) / 2);
    lastX = Math.max(-limitX, Math.min(limitX, lastX));
    lastY = Math.max(-limitY, Math.min(limitY, lastY));
  }

  function resetView() {
    scale = 1;
    lastX = 0;
    lastY = 0;
    setTransform();
  }

  function wheelZoom(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.min(maxScale, Math.max(minScale, scale * delta));

    // zoom around mouse pointer
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const relX = (cx - lastX) / scale;
    const relY = (cy - lastY) / scale;

    scale = newScale;
    lastX = e.clientX - rect.left - relX * scale;
    lastY = e.clientY - rect.top - relY * scale;

    clampPan();
    setTransform();
  }

  function dblToggle(e) {
    e.preventDefault();
    if (scale === 1) {
      scale = 3;
      const rect = img.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      lastX = -cx;
      lastY = -cy;
    } else {
      resetView();
    }
    clampPan();
    setTransform();
  }

  function startPan(e) {
    if (scale === 1) return;
    panning = true;
    img.setPointerCapture(e.pointerId);
    startX = e.clientX - lastX;
    startY = e.clientY - lastY;
    img.style.cursor = 'grabbing';
  }

  function movePan(e) {
    if (!panning) return;
    lastX = e.clientX - startX;
    lastY = e.clientY - startY;
    clampPan();
    setTransform();
  }

  function endPan(e) {
    panning = false;
    img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    try { img.releasePointerCapture(e.pointerId); } catch {}
  }

  function onOpen() {
    resetView();
    img.style.cursor = 'zoom-in';
    img.style.touchAction = 'none';
  }

  const _open = window.openViewer || function(){ viewer.hidden = false; };
  window.openViewer = function(url, title) {
    _open(url, title);
    if (img.complete) onOpen();
    else img.onload = onOpen;
  };

  viewer.addEventListener('wheel', wheelZoom, { passive: false });
  img.addEventListener('dblclick', dblToggle);
  img.addEventListener('pointerdown', startPan);
  img.addEventListener('pointermove', movePan);
  img.addEventListener('pointerup', endPan);
  img.addEventListener('pointercancel', endPan);

  // ESC resets zoom
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && scale > 1) resetView();
  });
})();
