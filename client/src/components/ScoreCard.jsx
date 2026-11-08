import { percent, scoreLevel } from "../utils";

export default function ScoreCard({ last, average, noFace, waitingFirst, progress }) {
  const level = scoreLevel(last?.score);
  return (
    <div className="score-card" aria-live="polite">
      <div className="score-label">Current attention score</div>
      {waitingFirst ? (
        <>
          <div className="score-number muted">…</div>
          <div className="small muted">The first score appears after about 10 seconds</div>
          <div className="progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </>
      ) : noFace ? (
        <>
          <div className="score-number" style={{ color: "#94a3b8" }}>—</div>
          <div className="badge badge-gray">No face detected</div>
          <div className="small muted">Sit in front of the camera so we can measure.</div>
        </>
      ) : (
        <>
          <div className="score-number" style={{ color: level.color }}>{percent(last?.score)}</div>
          <div className="meter"><span style={{ width: `${(last?.score || 0) * 100}%`, background: level.color }} /></div>
          <div className="badge" style={{ background: level.color }}>{level.label}</div>
        </>
      )}
      {average != null && <div className="small muted avg">Session average: {percent(average)}</div>}
      {last?.debug && (
        <div className="small debug-box">
          Debug · model (raw): <b>{percent(last.raw_score)}</b> · shown: <b>{percent(last.score)}</b>
          <br />inputs: {Object.entries(last.debug).map(([mode, r]) => (
            <span key={mode}> {mode} {percent(r.score)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
