import { Vector3 } from 'three';

export const rowsByZone = {
  A: [.55, 1.45, 2.35, 3.25],
  B: [4.75, 5.65, 6.55, 7.45],
};

export function irrigationAnimation(holder, camera) {
  const overlay = document.createElement('canvas');
  overlay.className = 'water-animation';
  overlay.setAttribute('aria-hidden', 'true');
  const ctx = overlay.getContext('2d');
  const point = new Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  holder.append(overlay);
  let frame;
  let zone;
  let start;

  function draw(x, y, z, radius, alpha, width, height) {
    point.set(x, y, z).project(camera);
    if (point.z < -1 || point.z > 1) return;
    const px = (point.x + 1) * width / 2;
    const py = (1 - point.y) * height / 2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(px, py, radius, radius * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function animate(now) {
    if (!zone) return;
    const width = holder.clientWidth;
    const height = holder.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    if (overlay.width !== Math.round(width * ratio) || overlay.height !== Math.round(height * ratio)) {
      overlay.width = Math.round(width * ratio);
      overlay.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    camera.updateMatrixWorld();
    ctx.fillStyle = '#39c9ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    const time = (now - start) / 1000;
    rowsByZone[zone].forEach((x, row) => {
      for (let segment = 0; segment < 3; segment++) {
        const distance = (time * .46 + segment / 3 + row * .08) % 1;
        draw(x, .14, -.92 - 18 * distance, 2.2, .95, width, height);
      }
      for (const [index, plant] of [zone === 'A' ? 3 : 4, 12, 22, 33].entries()) {
        const phase = (time * 1.6 + row * .21 + index * .32) % 1;
        draw(x + .09, .83 - phase * .53, -1.225 - plant * .45, 2.5 - phase * .5, 1 - phase * .55, width, height);
      }
    });
    frame = requestAnimationFrame(animate);
  }

  return activeZone => {
    cancelAnimationFrame(frame);
    zone = activeZone;
    overlay.hidden = !zone || reducedMotion.matches;
    if (overlay.hidden) return;
    start = performance.now();
    frame = requestAnimationFrame(animate);
  };
}
