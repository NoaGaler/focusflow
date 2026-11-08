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
            onError: () => onError?.("לא ניתן לנגן את הסרטון (ייתכן שהוא פרטי, נמחק או שהבעלים חסם הטמעה)."),
          },
        });
      })
      .catch(() => onError?.("לא הצלחנו לטעון את נגן YouTube. בדקו את החיבור לאינטרנט."));
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
    <div className="reader" ref={readerRef} onScroll={onScroll} tabIndex={0} aria-label="הטקסט לקריאה">
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
      if (e.status === 404 || e.status === 409) setError("הסשן נסגר. אפשר להתחיל סשן חדש.");
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

  if (loadError === "notfound") return <NotFound message="הפריט לא נמצא. ייתכן שהוא נמחק או שאינו שייך לחשבון שלך." />;
  if (loadError) return <Alert>{loadError}</Alert>;
  if (!content) return <p className="muted">טוען...</p>;

  const avg = readings.length ? readings.reduce((a, r) => a + r.score, 0) / readings.length : null;
  const driftPoints = findDriftPoints(readings, content.type);
  const running = phase === "active" && tracker.status === "running";

  return (
    <section className="watch">
      <div className="watch-head">
        <Link to="/library" className="muted">→ חזרה לספרייה</Link>
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
                <strong>נראה שהריכוז ירד.</strong>{" "}
                {isText ? "לחזור לקטע שבו התחלת לאבד את החוט?" : `לחזור ל-${formatPosition(drift.position)}, הרגע שבו התחלת לפספס?`}
              </div>
              <div className="drift-actions">
                <button className="btn btn-primary" onClick={() => { seek(drift.position); setDrift(null); }}>
                  {isText ? "חזרה לקטע" : `חזרה ל-${formatPosition(drift.position)}`}
                </button>
                <button className="btn btn-ghost" onClick={() => setDrift(null)}>אני בסדר, להמשיך</button>
              </div>
            </div>
          )}

          <FocusTimeline readings={readings} duration={isText ? 100 : duration} current={current}
                         contentType={content.type} onSeek={seek} driftPoints={driftPoints} />
        </div>

        <aside className="watch-side card">
          {phase === "ready" || phase === "starting" ? (
            <div className="consent">
              <h2>מדידת קשב</h2>
              <p className="small">
                בלחיצה על הכפתור תופעל המצלמה. <strong>התמונה לא נשמרת ולא יוצאת מהמחשב</strong>:
                הדפדפן מחשב נקודות פנים, מודל הקשב רץ אצלך, ולשרת נשלח רק הציון (מספר בין 0 ל-100) והמיקום בסרטון.
                הציון הראשון יופיע אחרי כ-10 שניות. אפשר גם לצפות בלי מדידה.
              </p>
              {cameras.length > 1 && (
                <>
                  <label htmlFor="cam">מצלמה</label>
                  <select id="cam" value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
                    <option value="">ברירת המחדל</option>
                    {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </>
              )}
              <Alert>{tracker.error || error}</Alert>
              <button className="btn btn-primary btn-block" onClick={startSession} disabled={phase === "starting"}>
                {phase === "starting" ? "מפעיל מצלמה וטוען מודל..." : "אני מסכים/ה – הפעלת מצלמה והתחלת סשן"}
              </button>
            </div>
          ) : (
            <>
              <ScoreCard last={last} average={avg} noFace={noFace && running}
                         waitingFirst={!last && !noFace} progress={tracker.progress} />
              <Alert>{error}</Alert>
              <button className="btn btn-danger btn-block" onClick={endSession} disabled={phase === "ending"}>
                {phase === "ending" ? "מסיים..." : "סיום סשן"}
              </button>
            </>
          )}

          <div className={`camera-box ${tracker.status === "running" ? "" : "hidden"}`}>
            <video ref={tracker.videoRef} muted playsInline aria-label="תצוגת מצלמה" />
            <canvas ref={tracker.canvasRef} aria-hidden="true" />
            <span className={`face-dot ${tracker.faceVisible ? "on" : ""}`}>
              {tracker.faceVisible ? "פנים זוהו" : "לא זוהו פנים"}
            </span>
          </div>

          {session && (
            <div className="drift-list">
              <h3>נקודות חזרה</h3>
              {driftPoints.length === 0 ? (
                <p className="small muted">עדיין אין. כשהריכוז יירד, הרגע יופיע כאן.</p>
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
