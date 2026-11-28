export function captureLayoutPreview(source, render) {
  if (!source.width || !source.height || !source.clientWidth) return undefined;
  try {
    render();
    const scale = Math.min(384 / source.width, 250 / source.height, 1);
    const image = document.createElement('canvas');
    image.width = Math.max(1, Math.round(source.width * scale));
    image.height = Math.max(1, Math.round(source.height * scale));
    const context = image.getContext('2d');
    if (!context) return undefined;
    context.fillStyle = '#34463a';
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(source, 0, 0, image.width, image.height);
    return image.toDataURL('image/webp', .72);
  } catch {
    return undefined;
  }
}
