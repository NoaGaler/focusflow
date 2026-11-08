// Watching / reading screen: the content, the camera, the live score,
// the colored attention timeline and the "rewind points".
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";
import FocusTimeline from "../components/FocusTimeline";
import ScoreCard from "../components/ScoreCard";
import { listCameras, useFocusTracker } from "../focus/useFocusTracker";
import { loadYouTubeApi } from "../focus/youtube";
import { findDriftPoints, formatPosition, LOW_FOCUS } from "../utils";
import NotFound from "./NotFound";

function YouTubePlayer({ videoId, startAt, playerRef, onReady, onError }) {
  const holder = useRef(null);
  useEffect(() => {
    let player;
    let cancelled = false;
    const el = document.createElement("div");
    holder.current.appendChild(el);
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(el, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { start: Math.floor(startAt || 0), rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: () => {
              playerRef.current = player;
              onReady?.(player);
            },
            onError: () => onError?.("This video cannot be played (it may be private, deleted, or its owner blocked embedding)."),
          },
        });
      })
      .catch(() => onError?.("Could not load the YouTube player. Check your internet connection."));
    return () => {
      cancelled = true;
      playerRef.current = null;
      try { player?.destroy(); } catch { /* ignore */ }
      el.remove();
    };
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="player" ref={holder} />;
}

function TextReader({ text, readerRef, onScroll }) {
  const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => p.trim());
  return (
    // React escapes all text, so pasted HTML/JS is shown as plain text (no XSS).
    <div className="reader" ref={readerRef} onScroll={onScroll} tabIndex={0} aria-label="Text to read">
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

export default function Watch() {
  const { contentId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [playerError, setPlayerError] = useState("");
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [session, setSession] = useState(null); // { id }
  const [phase, setPhase] = useState("ready"); // ready | starting | active | ending
  const [error, setError] = useState("");
  const [readings, setReadings] = useState([]);
  const [last, setLast] = useState(null);
  const [noFace, setNoFace] = useState(false);
  const [drift, setDrift] = useState(null); // { position } when focus just dropped

  const playerRef = useRef(null);
  const readerRef = useRef(null);
  const sessionRef = useRef(null);
  const wasLowRef = useRef(false);

  // ---- load the content item (404 if it is not the user's) ----
  useEffect(() => {
    api(`/content/${contentId}`)
      .then(setContent)
      .catch((e) => setLoadError(e.status === 404 ? "notfound" : e.message));
    listCameras().then(setCameras);
  }, [contentId]);

  const isText = content?.type === "text";

  const getPosition = useCallback(() => {
    if (isText) {
      const el = readerRef.current;
      if (!el) return 0;
      const max = el.scrollHeight - el.clientHeight;
      return max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0;
    }
    try { return playerRef.current?.getCurrentTime?.() || 0; } catch { return 0; }
  }, [isText]);

  // keep the playhead on the timeline in sync
  useEffect(() => {
    const t = setInterval(() => {
      setCurrent(getPosition());
      if (!isText && playerRef.current?.getDuration) setDuration(playerRef.current.getDuration() || 0);
    }, 500);
    return () => clearInterval(t);
  }, [getPosition, isText]);

  const seek = useCallback((pos) => {
    if (isText) {
      const el = readerRef.current;
      if (el) el.scrollTo({ top: (pos / 100) * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
    } else if (playerRef.current) {
      playerRef.current.seekTo(pos, true);
      playerRef.current.playVideo();
    }
    setCurrent(pos);
  }, [isText]);

  // ---- a new score arrives from the model (every ~5 seconds) ----
  const onScore = useCallback(async (result) => {
    const sid = sessionRef.current;
    if (!sid) return;
    if (result.noFace) {
      setNoFace(true);
      return;
    }
    setNoFace(false);
    const reading = { position: Math.round(getPosition() * 100) / 100, score: result.score, level: result.level };
    setLast(reading);
    setReadings((list) => [...list, reading]);

    const low = reading.score < LOW_FOCUS;
    if (low && !wasLowRef.current) {
      const back = isText ? Math.max(0, reading.position - 5) : Math.max(0, reading.position - 10);
      setDrift((d) => d || { position: back });
    }
    wasLowRef.current = low;

    try {
      await api(`/sessions/${sid}/readings`, { method: "POST", body: reading });
    } catch (e) {
      if (e.status === 404 || e.status === 409) setError("This session was closed. You can start a new one.");
    }
  }, [getPosition, isText]);

  const tracker = useFocusTracker({ onScore });

  async function startSession() {
    setError("");
    setPhase("starting");
    const ok = await tracker.start(cameraId || undefined);
    if (!ok) {
      setPhase("ready");
      return;
    }
    listCameras().then(setCameras); // now with real camera names
    try {
      const s = await api("/sessions", { method: "POST", body: { content_id: contentId } });
      sessionRef.current = s.id;
      setSession(s);
      setReadings([]);
      setLast(null);
      setDrift(null);
      wasLowRef.current = false;
      setPhase("active");
      try { playerRef.current?.playVideo(); } catch { /* ignore */ }
    } catch (e) {
      tracker.stop();
      setError(e.message);
      setPhase("ready");
    }
  }

  async function endSession() {
    const sid = sessionRef.current;
    if (!sid) return;
    setPhase("ending");
    tracker.stop();
    try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
    try {
      await api(`/sessions/${sid}/end`, { method: "POST" });
      sessionRef.current = null;
      navigate(`/history/${sid}?finished=1`);
    } catch (e) {
      setError(e.message);
      setPhase("active");
    }
  }

  // Leaving the page in the middle of a session closes it on the server.
  useEffect(() => () => {
    if (sessionRef.current) api(`/sessions/${sessionRef.current}/end`, { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  if (loadError === "notfound") return <NotFound message="This item was not found. It may have been deleted, or it does not belong to your account." />;
  if (loadError) return <Alert>{loadError}</Alert>;
  if (!content) return <p className="muted">Loading...</p>;

  const avg = readings.length ? readings.reduce((a, r) => a + r.score, 0) / readings.length : null;
  const driftPoints = findDriftPoints(readings, content.type);
  const running = phase === "active" && tracker.status === "running";

  return (
    <section className="watch">
      <div className="watch-head">
        <Link to="/library" className="muted">← Back to my library</Link>
        <h1>{content.title}</h1>
      </div>

      <div className="watch-grid">
        <div className="watch-main">
          {isText ? (
            <TextReader text={content.source} readerRef={readerRef} onScroll={() => setCurrent(getPosition())} />
          ) : (
            <YouTubePlayer videoId={content.video_id} startAt={Number(params.get("t")) || 0} playerRef={playerRef}
                           onReady={(p) => setDuration(p.getDuration() || 0)} onError={setPlayerError} />
          )}
          <Alert>{playerError}</Alert>

          {drift && (
            <div className="drift-alert" role="alert">
              <div>
                <strong>Looks like your focus dropped.</strong>{" "}
                {isText ? "Go back to the part where you started to drift?" : `Go back to ${formatPosition(drift.position)}, where you started to drift?`}
              </div>
              <div className="drift-actions">
                <button className="btn btn-primary" onClick={() => { seek(drift.position); setDrift(null); }}>
                  {isText ? "Go back" : `Rewind to ${formatPosition(drift.position)}`}
                </button>
                <button className="btn btn-ghost" onClick={() => setDrift(null)}>I'm fine, continue</button>
              </div>
            </div>
          )}

          <FocusTimeline readings={readings} duration={isText ? 100 : duration} current={current}
                         contentType={content.type} onSeek={seek} driftPoints={driftPoints} />
        </div>

        <aside className="watch-side card">
          {phase === "ready" || phase === "starting" ? (
            <div className="consent">
              <h2>Attention tracking</h2>
              <p className="small">
                Clicking the button turns on your camera. <strong>The video is never saved and never leaves your computer</strong>:
                your browser finds face points, the attention model runs on your device, and only the score (0-100) and the
                position in the video are sent to the server. The first score appears after about 10 seconds.
                You can also just watch without tracking.
              </p>
              {cameras.length > 1 && (
                <>
                  <label htmlFor="cam">Camera</label>
                  <select id="cam" value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
                    <option value="">Default camera</option>
                    {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </>
              )}
              <Alert>{tracker.error || error}</Alert>
              <button className="btn btn-primary btn-block" onClick={startSession} disabled={phase === "starting"}>
                {phase === "starting" ? "Starting camera and loading model..." : "I agree – turn on camera and start session"}
              </button>
            </div>
          ) : (
            <>
              <ScoreCard last={last} average={avg} noFace={noFace && running}
                         waitingFirst={!last && !noFace} progress={tracker.progress} />
              <Alert>{error}</Alert>
              <button className="btn btn-danger btn-block" onClick={endSession} disabled={phase === "ending"}>
                {phase === "ending" ? "Ending..." : "End session"}
              </button>
            </>
          )}

          <div className={`camera-box ${tracker.status === "running" ? "" : "hidden"}`}>
            <video ref={tracker.videoRef} muted playsInline aria-label="Camera preview" />
            <canvas ref={tracker.canvasRef} aria-hidden="true" />
            <span className={`face-dot ${tracker.faceVisible ? "on" : ""}`}>
              {tracker.faceVisible ? "Face detected" : "No face detected"}
            </span>
          </div>

          {session && (
            <div className="drift-list">
              <h3>Rewind points</h3>
              {driftPoints.length === 0 ? (
                <p className="small muted">None yet. When your focus drops, the moment will appear here.</p>
              ) : (
                <ul>
                  {driftPoints.map((p, i) => (
                    <li key={i}>
                      <button className="link" onClick={() => seek(p.position)}>
                        ↺ {formatPosition(p.position, content.type)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
