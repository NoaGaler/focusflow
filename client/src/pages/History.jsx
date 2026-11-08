import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";
import { durationBetween, formatDate, percent, scoreLevel } from "../utils";

// Small chart: the average score of each session, oldest -> newest.
function TrendChart({ sessions }) {
  const pts = sessions.filter((s) => s.average_score != null).slice().reverse();
  if (pts.length < 2) return null;
  const W = 600, H = 120, pad = 14;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v) => pad + (H - 2 * pad) * (1 - v);
  return (
    <div className="card">
      <h2>הקשב שלי לאורך זמן</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" dir="ltr" role="img" aria-label="ממוצע הקשב בכל סשן לאורך זמן">
        <line x1={pad} x2={W - pad} y1={y(0.4)} y2={y(0.4)} className="threshold" />
        <polyline fill="none" stroke="#4f46e5" strokeWidth="2.5" points={pts.map((s, i) => `${x(i)},${y(s.average_score)}`).join(" ")} />
        {pts.map((s, i) => (
          <circle key={s.id} cx={x(i)} cy={y(s.average_score)} r="5" fill={scoreLevel(s.average_score).color}>
            <title>{`${formatDate(s.started_at)} · ${s.content_title}: ${percent(s.average_score)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default function History() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/sessions").then(setSessions).catch((e) => setError(e.message));
  }, []);

  return (
    <section className="stack">
      <h1>היסטוריית סשנים</h1>
      <Alert>{error}</Alert>
      {sessions === null && !error && <p className="muted">טוען...</p>}
      {sessions?.length === 0 && (
        <div className="card empty">
          <p><strong>עדיין אין סשנים.</strong></p>
          <p className="muted">היכנסו ל<Link to="/library">ספרייה</Link>, בחרו פריט ולחצו "התחלת סשן".</p>
        </div>
      )}
      {sessions?.length > 0 && (
        <>
          <TrendChart sessions={sessions} />
          <ul className="session-list">
            {sessions.map((s) => {
              const lvl = scoreLevel(s.average_score);
              return (
                <li key={s.id}>
                  <Link to={`/history/${s.id}`} className="card session-row">
                    <span className="avg-badge" style={{ background: lvl.color }} title="ציון ממוצע">{percent(s.average_score)}</span>
                    <span className="session-main">
                      <strong>{s.content_title}</strong>
                      <span className="small muted">
                        {formatDate(s.started_at)}
                        {s.ended_at ? ` · משך ${durationBetween(s.started_at, s.ended_at)}` : " · לא הסתיים"}
                        {` · ${s.reading_count} מדידות`}
                      </span>
                    </span>
                    <span className="muted">לפרטים ←</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
