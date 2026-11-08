// The measuring loop:
//   camera -> 10 frames per second -> MediaPipe face points -> keep the last 100 frames
//   -> every 5 seconds run the model on those 100 frames (= last 10 seconds) -> onScore()
import { useCallback, useEffect, useRef, useState } from "react";
import { detectFace, getLandmarker } from "./landmarker";
import { getModel, POINTS, scoreWindow, WINDOW_FRAMES } from "./model";

const FPS = 10;
const SCORE_EVERY_MS = 5000;
const MIN_FACE_FRAMES = WINDOW_FRAMES / 2; // need a face in at least half of the window

export function cameraErrorMessage(err) {
  if (!navigator.mediaDevices) return "The camera only works on a secure site (https). Open the site with https://.";
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access from the browser's address bar and try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found. Connect a camera and try again.";
    case "NotReadableError":
      return "The camera is being used by another app (e.g. Zoom). Close it and try again.";
    default:
      return "Could not start the camera or the attention model. Try refreshing the page.";
  }
}

export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export function useFocusTracker({ onScore }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  const [status, setStatus] = useState("idle"); // idle | loading | running | error
  const [error, setError] = useState("");
  const [faceVisible, setFaceVisible] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 until the first window is full

  const state = useRef({ stream: null, frameTimer: null, scoreTimer: null, frames: [], lastTs: 0, busy: false, face: null });

  const stop = useCallback(() => {
    const s = state.current;
    clearInterval(s.frameTimer);
    clearInterval(s.scoreTimer);
    s.frameTimer = s.scoreTimer = null;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    s.frames = [];
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((st) => (st === "error" ? st : "idle"));
    setFaceVisible(false);
    setProgress(0);
  }, []);

  useEffect(() => stop, [stop]); // stop the camera when leaving the page

  const drawPoints = (face) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const w = (canvas.width = video.videoWidth || 320);
    const h = (canvas.height = video.videoHeight || 240);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!face) return;
    ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
    for (let i = 0; i < face.length; i += 2) ctx.fillRect(face[i].x * w, face[i].y * h, 2, 2);
  };

  const runModel = async () => {
    const s = state.current;
    if (s.busy || s.frames.length < WINDOW_FRAMES) return;
    s.busy = true;
    try {
      const window = s.frames.slice(-WINDOW_FRAMES);
      const valid = window.filter(Boolean);
      if (valid.length < MIN_FACE_FRAMES) {
        onScoreRef.current?.({ noFace: true });
        return;
      }
      // Fill frames without a face with the closest earlier face (or the first one found).
      const input = new Float32Array(WINDOW_FRAMES * POINTS * 3);
      let last = valid[0];
      window.forEach((f, i) => {
        if (f) last = f;
        input.set(last, i * POINTS * 3);
      });
      const result = await scoreWindow(input);
      onScoreRef.current?.(result);
    } catch (e) {
      console.error("model error", e);
    } finally {
      s.busy = false;
    }
  };

  const start = useCallback(async (deviceId) => {
    stop();
    setError("");
    setStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("insecure");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480 },
        audio: false,
      });
      state.current.stream = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const [landmarker] = await Promise.all([getLandmarker(), getModel()]);
      if (!state.current.stream) return; // stopped while loading

      const s = state.current;
      s.frameTimer = setInterval(() => {
        if (video.readyState < 2) return;
        const ts = Math.max(performance.now(), s.lastTs + 1); // must always increase
        s.lastTs = ts;
        let detected;
        try {
          detected = detectFace(landmarker, video, ts);
        } catch {
          return;
        }
        s.frames.push(detected.points);
        if (s.frames.length > WINDOW_FRAMES) s.frames.shift();
        drawPoints(detected.face);
        const visible = !!detected.points;
        if (visible !== s.face) {
          s.face = visible;
          setFaceVisible(visible);
        }
        setProgress((p) => (p >= 1 ? p : Math.min(1, s.frames.length / WINDOW_FRAMES)));
      }, 1000 / FPS);
      s.scoreTimer = setInterval(runModel, SCORE_EVERY_MS);
      setStatus("running");
      return true;
    } catch (e) {
      console.error(e);
      stop();
      setError(cameraErrorMessage(e));
      setStatus("error");
      return false;
    }
  }, [stop]);

  return { videoRef, canvasRef, status, error, faceVisible, progress, start, stop };
}
