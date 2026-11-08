import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";
import FocusChart from "../components/FocusChart";
import FocusTimeline from "../components/FocusTimeline";
import { durationBetween, findDriftPoints, formatDate, formatPosition, percent, scoreLevel } from "../utils";
import NotFound from "./NotFound";

export default function SessionDetail() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const [s, setS] = useState(null);
  const [contentExists, setContentExists] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/sessions/${sessionId}`)
      .then((data) => {
        setS(data);
        api(`/content/${data.content_id}`).catch(() => setContentExists(false));
      })
      .catch((e) => setError(e.status === 404 ? "notfound" : e.message));
  }, [sessionId]);

  if (error === "notfound") return <NotFound message="הסשן לא נמצא. ייתכן שאינו שייך לחשבון שלך." />;
  if (error) return <Alert>{error}</Alert>;
  if (!s) return <p className="muted">טוען...</p>;

  const type = s.content_type || "youtube";
  const drift = findDriftPoints(s.readings, type);
  const lvl = scoreLevel(s.average_score);
  const low = s.readings.filter((r) => r.score < 0.4).length;

  return (
    <section className="stack">
      {params.get("finished") && <Alert type="success">הסשן הסתיים ונשמר בהיסטוריה.</Alert>}
      <Link to="/history" className="muted">→ חזרה להיסטוריה</Link>
      <h1>{s.content_title}</h1>
      <div className="stats">
        <div className="card stat"><span className="stat-num" style={{ color: lvl.color }}>{percent(s.average_score)}</span><span>ציון ממוצע · {lvl.label}</span></div>
        <div className="card stat"><span className="stat-num">{s.reading_count}</span><span>מדידות</span></div>
        <div className="card stat"><span className="stat-num">{s.ended_at ? durationBetween(s.started_at, s.ended_at) : "—"}</span><span>משך הסשן</span></div>
        <div className="card stat"><span className="stat-num">{drift.length}</span><span>נקודות חזרה</span></div>
      </div>
      <p className="muted small">התחיל ב-{formatDate(s.started_at)}{s.reading_count ? ` · ${low} מתוך ${s.reading_count} מדידות היו בקשב נמוך` : ""}</p>

      <div className="card">
        <h2>הקשב לאורך הסשן</h2>
        <FocusChart readings={s.readings} contentType={type} />
        <FocusTimeline readings={s.readings} duration={type === "text" ? 100 : 0} contentType={type} driftPoints={drift} />
      </div>

      <div className="card">
        <h2>נקודות חזרה – מה כדאי לראות שוב</h2>
        {drift.length === 0 ? (
          <p className="muted">לא נמצאו רגעים של ירידה בקשב. כל הכבוד!</p>
        ) : (
          <ul className="drift-table">
            {drift.map((p, i) => (
              <li key={i}>
                <span>הריכוז ירד סביב <strong>{formatPosition(p.position, type)}</strong></span>
                {contentExists && type === "youtube" && (
                  <Link className="btn btn-primary btn-sm" to={`/watch/${s.content_id}?t=${Math.floor(p.position)}`}>
                    לצפות שוב מ-{formatPosition(p.position)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {contentExists ? (
          <Link className="btn btn-ghost" to={`/watch/${s.content_id}`}>סשן חדש על אותו תוכן</Link>
        ) : (
          <p className="small muted">פריט התוכן נמחק מהספרייה, אבל הסשן נשמר.</p>
        )}
      </div>
    </section>
  );
}
