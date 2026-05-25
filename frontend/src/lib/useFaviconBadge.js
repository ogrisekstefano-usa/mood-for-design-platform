/**
 * useFaviconBadge · ITER154
 *
 * Dynamically paints a tiny cyan dot on the favicon when there are
 * unread notifications, and clears it when count → 0.
 * The dot also includes the number for counts ≤ 9. Falls back to a
 * plain dot for higher counts.
 *
 * Strategy:
 *   - Find the highest-res existing favicon link in <head>
 *   - Cache its original href on first call
 *   - Render to a 32×32 canvas: base favicon + overlay dot
 *   - Replace icon href with a data URL
 *
 * Pure DOM, no extra deps.
 */
import { useEffect, useRef } from 'react';

const SIZE = 32;
const DOT_RADIUS = 7;
const DOT_COLOR = '#00C9B3';

let _originalHref = null;
let _baseImage = null;  // pre-loaded HTMLImageElement

const _loadBase = (href) => new Promise((resolve) => {
  if (_baseImage && _baseImage.src === href) return resolve(_baseImage);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { _baseImage = img; resolve(img); };
  img.onerror = () => resolve(null);
  img.src = href;
});

const _writeFavicon = async (count) => {
  let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (_originalHref === null) _originalHref = link.href;

  if (!count || count <= 0) {
    if (_originalHref) link.href = _originalHref;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const base = _originalHref ? await _loadBase(_originalHref) : null;
  if (base) ctx.drawImage(base, 0, 0, SIZE, SIZE);
  else {
    ctx.fillStyle = '#14110D';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Cyan dot (top-right)
  ctx.beginPath();
  ctx.arc(SIZE - DOT_RADIUS - 1, DOT_RADIUS + 1, DOT_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = DOT_COLOR;
  ctx.fill();
  ctx.strokeStyle = '#0E0D0B';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (count <= 9) {
    ctx.fillStyle = '#0E0D0B';
    ctx.font = 'bold 9px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), SIZE - DOT_RADIUS - 1, DOT_RADIUS + 2);
  }

  link.href = canvas.toDataURL('image/png');
};

const useFaviconBadge = (count) => {
  const lastRef = useRef(-1);
  useEffect(() => {
    if (lastRef.current === count) return;
    lastRef.current = count;
    _writeFavicon(count).catch(() => {});
  }, [count]);
};

export default useFaviconBadge;
