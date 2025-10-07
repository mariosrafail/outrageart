// js/zoom.js — Click/Tap to Zoom with direct dragging (no momentum)
// Drag after zoom = image follows your cursor. Pinch on touch. Ctrl+wheel to zoom.
// Removes the X button. Single-click toggles: zoom-in (from 1x) / zoom-out (when zoomed).
(() => {
  const viewer = document.getElementById('viewer');
  const viewerImg = document.getElementById('viewerImg');
  const viewerContent = document.querySelector('.viewer-content');
  if (!viewer || !viewerImg || !viewerContent) return;

  // Remove the X button if it exists
  const xBtn = document.getElementById('viewerClose');
  if (xBtn) xBtn.remove();

  // ===== Tuning =====
  const ZOOM_CLICK_IN    = 2.4;   // single click zoom-in scale
  const ZOOM_WHEEL_STEP  = 1.12;  // ctrl+wheel multiplier
  const MAX_SCALE        = 4;
  const MIN_SCALE        = 1;
  const DRAG_THRESHOLD   = 4;     // px movement to start drag (keeps clicks as clicks)

  // ===== State =====
  let scale = 1;
  let tx = 0, ty = 0;             // translation (pixels in screen coords)
  let dragging = false;
  let lastX = 0, lastY = 0;

  // touch
  let pointers = new Map();
  let startPinchDist = 0;
  let startScale = 1;

  // click guard
  let clickStart = { x: 0, y: 0, t: 0 };

  // setup
  viewerImg.style.touchAction = 'none';
  viewerImg.style.cursor = 'zoom-in';
  viewerImg.classList.remove('is-zoomed');
  viewerImg.style.transformOrigin = '50% 50%'; // simpler bounds math

  // stop backdrop clicks from interfering
  viewerImg.addEventListener('click', (e) => e.stopPropagation());

  // ===== Utils =====
  function contRect() { return viewerContent.getBoundingClientRect(); }
  function imgRect()  { return viewerImg.getBoundingClientRect(); }

  function applyTransform() {
    viewerImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  // Keep image within container (no background showing)
  function clampTranslate() {
    const c = contRect();
    const w1 = viewerImg.clientWidth;  // unscaled layout size
    const h1 = viewerImg.clientHeight;

    const maxX = Math.max(0, (w1 * scale - c.width) / 2);
    const maxY = Math.max(0, (h1 * scale - c.height) / 2);

    if (tx >  maxX) tx =  maxX;
    if (tx < -maxX) tx = -maxX;
    if (ty >  maxY) ty =  maxY;
    if (ty < -maxY) ty = -maxY;
  }

  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

  // Animate zoom so the clicked point stays under the cursor/finger
  function focalZoomTo(targetScale, clientX, clientY, dur = 200) {
    const c = contRect();
    const rect = imgRect();

    const s0 = scale;
    const tx0 = tx, ty0 = ty;

    const cx = (clientX - c.left) - c.width / 2;
    const cy = (clientY - c.top)  - c.height / 2;

    const rectCenterX = rect.left + rect.width / 2;
    const rectCenterY = rect.top  + rect.height / 2;
    const offsetX = clientX - rectCenterX;
    const offsetY = clientY - rectCenterY;
    const pX = offsetX / s0;
    const pY = offsetY / s0;

    const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
    const tx1 = cx - pX * s1;
    const ty1 = cy - pY * s1;

    const t0 = performance.now();
    function tick(now){
      const t = Math.min(1, (now - t0) / dur);
      const k = easeOutCubic(t);
      scale = s0 + (s1 - s0) * k;
      tx    = tx0 + (tx1 - tx0) * k;
      ty    = ty0 + (ty1 - ty0) * k;
      clampTranslate();
      applyTransform();
      viewerImg.classList.toggle('is-zoomed', scale !== 1);
      viewerImg.style.cursor = (scale === 1) ? 'zoom-in' : 'grab';
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function resetZoom() {
    scale = 1; tx = 0; ty = 0;
    clampTranslate();
    applyTransform();
    viewerImg.style.cursor = 'zoom-in';
    viewerImg.classList.remove('is-zoomed');
  }

  // ===== Pointer events =====
  function pointerDown(ev) {
    ev.stopPropagation();
    viewerImg.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    clickStart = { x: ev.clientX, y: ev.clientY, t: performance.now() };

    lastX = ev.clientX;
    lastY = ev.clientY;

    // If already zoomed, allow immediate dragging
    if (pointers.size === 1 && scale > 1) {
      dragging = true;
      viewerImg.style.cursor = 'grabbing';
      ev.preventDefault();
    }

    // start pinch baseline
    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      startPinchDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      startScale = scale;
    }
  }

  function pointerMove(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    // Pinch to zoom (two fingers) — keep midpoint stable
    if (pointers.size === 2) {
      ev.preventDefault();
      const c = contRect();
      const arr = Array.from(pointers.values());
      const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (startPinchDist > 0) {
        const factor = dist / startPinchDist;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScale * factor));

        // midpoint in container coords (relative to center)
        const midX = (arr[0].x + arr[1].x) / 2 - c.left - c.width/2;
        const midY = (arr[0].y + arr[1].y) / 2 - c.top  - c.height/2;

        // keep midpoint stable
        const rect = imgRect();
        const rectCX = rect.left + rect.width/2;
        const rectCY = rect.top  + rect.height/2;
        const offsetX = (midX + c.left + c.width/2) - rectCX;
        const offsetY = (midY + c.top  + c.height/2) - rectCY;
        const pX = offsetX / scale;
        const pY = offsetY / scale;

        const txNew = midX - pX * newScale;
        const tyNew = midY - pY * newScale;

        scale = newScale;
        tx = txNew;
        ty = tyNew;

        clampTranslate();
        applyTransform();
        viewerImg.classList.toggle('is-zoomed', scale !== 1);
        viewerImg.style.cursor = (scale === 1) ? 'zoom-in' : 'grab';
      }
      return;
    }

    // ONE-FINGER / MOUSE
    if (pointers.size === 1) {
      const moved = Math.hypot(ev.clientX - clickStart.x, ev.clientY - clickStart.y);

      // If at 1x and user starts moving, do NOT drag the image (no zoom) — keep click behavior.
      // Dragging only makes sense when zoomed in.
      if (!dragging && scale > 1 && moved >= 1) {
        dragging = true;
        viewerImg.style.cursor = 'grabbing';
        // ensure clean deltas
        lastX = ev.clientX;
        lastY = ev.clientY;
      }

      if (dragging) {
        ev.preventDefault(); // prevent text-select/scroll
        const dx = (ev.clientX - lastX);
        const dy = (ev.clientY - lastY);
        lastX = ev.clientX;
        lastY = ev.clientY;

        tx += dx;
        ty += dy;

        clampTranslate();
        applyTransform();
      }
    }
  }

  function pointerUp(ev) {
    try { viewerImg.releasePointerCapture(ev.pointerId); } catch {}
    const moved = Math.hypot(ev.clientX - clickStart.x, ev.clientY - clickStart.y);
    const elapsed = performance.now() - clickStart.t;

    pointers.delete(ev.pointerId);

    if (pointers.size === 0) {
      const wasDragging = dragging;
      dragging = false;
      viewerImg.style.cursor = scale === 1 ? 'zoom-in' : 'grab';

      // Single click/tap toggles zoom
      if (moved < DRAG_THRESHOLD && elapsed < 250) {
        if (scale > 1) {
          // zoom OUT to center
          const c = contRect();
          focalZoomTo(1, c.left + c.width/2, c.top + c.height/2, 180);
        } else {
          // zoom IN at click point
          focalZoomTo(ZOOM_CLICK_IN, ev.clientX, ev.clientY, 180);
        }
      }
    } else if (pointers.size === 1) {
      const last = Array.from(pointers.values())[0];
      lastX = last.x; lastY = last.y;
      dragging = (scale > 1);
      viewerImg.style.cursor = dragging ? 'grabbing' : 'zoom-in';
    }
  }

  // ===== Wheel zoom (desktop ctrl+trackpad pinch) =====
  function onWheel(ev) {
    if (!ev.ctrlKey) return; // normal scroll unless pinch-zoom gesture
    ev.preventDefault();
    const step = (ev.deltaY < 0) ? ZOOM_WHEEL_STEP : (1/ZOOM_WHEEL_STEP);
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * step));
    if (newScale !== scale) {
      focalZoomTo(newScale, ev.clientX, ev.clientY, 140);
    }
  }

  // Reset on overlay close
  function onViewerHiddenChanged() {
    const hidden = viewer.hasAttribute('hidden') || viewer.style.display === 'none' || !viewer.classList.contains('show');
    if (hidden) resetZoom();
  }

  // ===== Bindings =====
  viewerImg.addEventListener('pointerdown', pointerDown);
  viewerImg.addEventListener('pointermove', pointerMove);
  viewerImg.addEventListener('pointerup', pointerUp);
  viewerImg.addEventListener('pointercancel', pointerUp);
  viewerImg.addEventListener('wheel', onWheel, { passive: false });

  // Keyboard toggle (optional, keeps accessibility)
  viewer.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const c = contRect();
      if (scale === 1) focalZoomTo(ZOOM_CLICK_IN, c.left + c.width/2, c.top + c.height/2, 180);
      else             focalZoomTo(1,            c.left + c.width/2, c.top + c.height/2, 180);
    }
  });

  // Reset when a new image loads
  viewerImg.addEventListener('load', () => resetZoom());

  // Observe show/hide
  const mo = new MutationObserver(onViewerHiddenChanged);
  mo.observe(viewer, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });

  // Re-clamp on resize
  window.addEventListener('resize', () => { clampTranslate(); applyTransform(); });
})();
