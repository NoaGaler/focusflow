import { percent, scoreLevel } from "../utils";

export default function ScoreCard({ last, average, noFace, waitingFirst, progress }) {
  const level = scoreLevel(last?.score);
  return (
    <div className="score-card" aria-live="polite">
      <div className="score-label">ציון קשב נוכחי</div>
      {waitingFirst ? (
        <>
          <div className="score-number muted">…</div>
          <div className="small muted">הציון הראשון יופיע אחרי כ-10 שניות</div>
          <div className="progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </>
      ) : noFace ? (
        <>
          <div className="score-number" style={{ color: "#94a3b8" }}>—</div>
          <div className="badge badge-gray">לא זוהו פנים</div>
          <div className="small muted">שבו מול המצלמה כדי שנוכל למדוד.</div>
        </>
      ) : (
        <>
          <div className="score-number" style={{ color: level.color }}>{percent(last?.score)}</div>
          <div className="meter"><span style={{ width: `${(last?.score || 0) * 100}%`, background: level.color }} /></div>
          <div className="badge" style={{ background: level.color }}>{level.label}</div>
        </>
      )}
      {average != null && <div className="small muted avg">ממוצע בסשן: {percent(average)}</div>}
    </div>
  );
}
