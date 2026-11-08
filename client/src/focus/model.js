// The attention model (v4_2.onnx), run in the browser with onnxruntime-web.
// Input:  [1, 100, 478, 3]  = 100 frames (10 seconds at 10 fps) of 478 face points.
// Output: regression_scores [1,1]  -> attention score 0..1 (higher = more focused)
//         classification_logits [1,5] -> 5 levels: not in camera / not engaged /
//                                        weakly engaged / engaged / highly engaged
import * as ort from "onnxruntime-web/wasm";

export const WINDOW_FRAMES = 100;
export const POINTS = 478;

// The .wasm file is bundled by Vite (it appears in dist/assets).
// One thread: works on every server without special cross-origin headers.
ort.env.wasm.numThreads = 1;

let sessionPromise = null;

export function getModel() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create("/models/v4_2.onnx", { executionProviders: ["wasm"] });
    sessionPromise.catch(() => (sessionPromise = null));
  }
  return sessionPromise;
}

/** frames: Float32Array of length 100 * 478 * 3. Returns { score, level }. */
export async function scoreWindow(frames) {
  const session = await getModel();
  const input = new ort.Tensor("float32", frames, [1, WINDOW_FRAMES, POINTS, 3]);
  const outputs = await session.run({ [session.inputNames[0]]: input });

  const raw = outputs[session.outputNames[0]].data[0]; // first output = the score
  const score = Math.min(1, Math.max(0, Number(raw)));

  let level = null;
  const logits = outputs[session.outputNames[1]]?.data;
  if (logits && logits.length === 5) {
    level = 0;
    for (let i = 1; i < 5; i++) if (logits[i] > logits[level]) level = i;
  }
  return { score, level };
}
