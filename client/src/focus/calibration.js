// The model's raw score lives in a narrow range (about 0.2 - 0.6), because it was
// trained on labels like 0.30 = not engaged, 0.50 = weakly engaged, 0.70 = engaged,
// and models like this pull toward the middle. Test sessions measured roughly:
//   looking at the screen, focused  -> 0.46
//   looking down (phone)            -> 0.35
//   head turned away                -> 0.30
// This table stretches that range to 0-100 for the display. Both numbers are saved:
// `score` (calibrated, what the user sees) and `raw_score` (the model's output).
const POINTS = [
  [0.0, 0.0],
  [0.25, 0.1],
  [0.3, 0.2],
  [0.35, 0.35],
  [0.4, 0.55],
  [0.45, 0.8],
  [0.5, 0.9],
  [0.6, 1.0],
];

export function calibrate(raw) {
  if (raw <= POINTS[0][0]) return POINTS[0][1];
  for (let i = 1; i < POINTS.length; i++) {
    const [x1, y1] = POINTS[i];
    if (raw <= x1) {
      const [x0, y0] = POINTS[i - 1];
      return y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}
