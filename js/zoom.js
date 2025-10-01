
// Lightweight Zoom & Pan for #viewerImg inside #viewer
(function(){
  const viewer = document.getElementById('viewer');
  const img = document.getElementById('viewerImg');
  if(!viewer || !img) return;

  let scale = 1;
  let minScale = 1;
  let maxScale = 6;
  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0;
  let isPanning = false;

  function setTransform(x, y, s){
    img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }

  function clampPan(x, y, s){
    const rect = viewer.getBoundingClientRect();
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if(!iw || !ih) return {x, y};
    // image size on screen
    const sw = iw * s;
    const sh = ih * s;
    const limitX = Math.max(0, (sw - rect.width)/2);
    const limitY = Math.max(0, (sh - rect.height)/2);
    x = Math.max(-limitX, Math.min(limitX, x));
    y = Math.max(-limitY, Math.min(limitY, y));
    return {x, y};
  }

  function wheelZoom(e){
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * -0.15; // invert: wheel up -> zoom in
    const newScale = Math.min(maxScale, Math.max(minScale, scale * (1 + delta)));

    // Zoom to cursor point: adjust pan so the point under cursor stays under cursor
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const nx = (cx - lastX) / scale;
    const ny = (cy - lastY) / scale;

    const k = newScale / scale;
    lastX = lastX - nx*(k-1)*scale;
    lastY = lastY - ny*(k-1)*scale;
    scale = newScale;

    const clamped = clampPan(lastX, lastY, scale);
    lastX = clamped.x; lastY = clamped.y;
    setTransform(lastX, lastY, scale);
  }

  function dblToggle(e){
    e.preventDefault();
    if(scale === 1){
      scale = 2.5;
      // center to click
      const rect = img.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width/2;
      const cy = e.clientY - rect.top - rect.height/2;
      lastX = -cx; lastY = -cy;
    }else{
      scale = 1; lastX = 0; lastY = 0;
    }
    const clamped = clampPan(lastX, lastY, scale);
    lastX = clamped.x; lastY = clamped.y;
    setTransform(lastX, lastY, scale);
  }

  function startPan(e){
    e.preventDefault();
    img.setPointerCapture(e.pointerId);
    isPanning = true;
    startX = e.clientX - lastX;
    startY = e.clientY - lastY;
  }
  function movePan(e){
    if(!isPanning) return;
    lastX = e.clientX - startX;
    lastY = e.clientY - startY;
    const clamped = clampPan(lastX, lastY, scale);
    lastX = clamped.x; lastY = clamped.y;
    setTransform(lastX, lastY, scale);
  }
  function endPan(e){
    isPanning = false;
    try{ img.releasePointerCapture(e.pointerId); }catch(_){}
  }

  function onOpen(){
    // reset on open
    scale = 1; lastX = 0; lastY = 0; isPanning = false;
    img.style.transformOrigin = "center center";
    img.style.touchAction = "none";  // allow pinch/drag on touch
    setTransform(0,0,1);
  }

  // Integrate with existing openViewer/closeViewer if present
  const _open = window.openViewer || function(){ viewer.hidden=false; };
  window.openViewer = function(url, title){
    _open(url, title);
    // Wait image load to compute bounds
    if(img.complete){
      onOpen();
    }else{
      img.onload = onOpen;
    }
  };

  // Events
  viewer.addEventListener('wheel', wheelZoom, { passive: false });
  img.addEventListener('dblclick', dblToggle);
  img.addEventListener('pointerdown', startPan);
  img.addEventListener('pointermove', movePan);
  img.addEventListener('pointerup', endPan);
  img.addEventListener('pointercancel', endPan);

  // Basic pinch-to-zoom (2 fingers): use gesture averaging
  let touchDist0 = 0;
  viewer.addEventListener('touchstart', (e)=>{
    if(e.touches.length===2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDist0 = Math.hypot(dx,dy);
    }
  }, {passive:false});
  viewer.addEventListener('touchmove', (e)=>{
    if(e.touches.length===2){
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx,dy);
      const factor = d / (touchDist0 || d);
      const newScale = Math.min(maxScale, Math.max(minScale, scale * factor));
      scale = newScale;
      const clamped = clampPan(lastX, lastY, scale);
      lastX = clamped.x; lastY = clamped.y;
      setTransform(lastX, lastY, scale);
      touchDist0 = d;
    }
  }, {passive:false});

})();
