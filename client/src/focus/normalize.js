// Two ways to give the face points to the model:
//  "raw":  MediaPipe's values relative to the WHOLE camera frame (0..1).
//  "crop": relative to a square crop around the face with a 20% margin -
//          the way the training data was prepared (face cropped to 256 px).
// The crop removes "where is the face in the frame" and "how far is the camera".

export const CROP_MARGIN = 0.2;

/** points: Float32Array(478*3) in frame coordinates; width/height: frame size in pixels. */
export function cropNormalize(points, width, height, margin = CROP_MARGIN) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const px = points[i] * width, py = points[i + 1] * height;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const side = Math.max(maxX - minX, maxY - minY) * (1 + 2 * margin); // square crop
  const left = (minX + maxX) / 2 - side / 2;
  const top = (minY + maxY) / 2 - side / 2;
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    out[i] = (points[i] * width - left) / side;
    out[i + 1] = (points[i + 1] * height - top) / side;
    out[i + 2] = (points[i + 2] * width) / side; // MediaPipe z uses the same scale as x
  }
  return out;
}
