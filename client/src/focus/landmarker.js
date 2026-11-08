// MediaPipe Face Landmarker: finds 478 face points (x, y, z) in a video frame.
// Everything runs in the browser; the video never leaves the computer.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise = null;

async function create(delegate) {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

/** Loads once and reuses. Tries the GPU first, falls back to the CPU. */
export function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = create("GPU").catch(() => create("CPU"));
    landmarkerPromise.catch(() => (landmarkerPromise = null)); // allow retry after failure
  }
  return landmarkerPromise;
}

/**
 * Returns a Float32Array of 478*3 numbers (x, y, z per point), or null if no face.
 * These are the raw MediaPipe values - the model was trained on exactly these.
 */
export function detectFace(landmarker, video, timestampMs) {
  const result = landmarker.detectForVideo(video, timestampMs);
  const face = result.faceLandmarks?.[0];
  if (!face || face.length !== 478) return { points: null, face: null };
  const points = new Float32Array(478 * 3);
  for (let i = 0; i < 478; i++) {
    points[i * 3] = face[i].x;
    points[i * 3 + 1] = face[i].y;
    points[i * 3 + 2] = face[i].z;
  }
  return { points, face };
}
