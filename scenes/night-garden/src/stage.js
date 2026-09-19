// One transform from the painted source image to the screen. Everything that has a place
// in the picture (perches, fireflies, the fern's root, the pointer) is expressed in source
// pixels and goes through this, so a 16:9 crop and a 16:10 fill agree about where the
// branch is. The image is scaled to cover the viewport and the overflow is cropped around
// an anchor: 0.5 keeps the middle, smaller values keep more of the top.
export const SOURCE = Object.freeze({ width: 1586, height: 992 });

export function coverTransform(viewWidth, viewHeight, {
  source = SOURCE, anchorX = 0.5, anchorY = 0.5,
} = {}) {
  if (!(viewWidth > 0 && viewHeight > 0)) return null;
  const scale = Math.max(viewWidth / source.width, viewHeight / source.height);
  const offsetX = (viewWidth - source.width * scale) * anchorX;
  const offsetY = (viewHeight - source.height * scale) * anchorY;
  return {
    scale,
    offsetX,
    offsetY,
    // The part of the source image that is on screen, in source pixels.
    visible: {
      x0: -offsetX / scale,
      y0: -offsetY / scale,
      x1: (viewWidth - offsetX) / scale,
      y1: (viewHeight - offsetY) / scale,
    },
    toSource: (x, y) => ({ x: (x - offsetX) / scale, y: (y - offsetY) / scale }),
    toView: (x, y) => ({ x: x * scale + offsetX, y: y * scale + offsetY }),
  };
}

// Source pixels (origin top-left, y down) to the scene's world units (origin at the
// picture's centre, y up), which is what the orthographic camera looks at.
export function toWorld(x, y, source = SOURCE) {
  return { x: x - source.width / 2, y: source.height / 2 - y };
}
