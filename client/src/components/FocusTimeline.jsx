// A bar under the video, colored by attention along the video time.
// Each score covers the 10 seconds before it. Click anywhere on the bar to jump there.
import { formatPosition, scoreLevel } from "../utils";

export default function FocusTimeline({ readings, duration, current = null, contentType, onSeek, driftPoints = [] }) {
  const total = Math.max(duration || 0, ...readings.map((r) => r.position), 1);
  const windowLen = contentType === "text" ? 5 : 10;

  function click(e) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fromLeft = (e.clientX - rect.left) / rect.width;
    onSeek(fromLeft * total);
  }

  return (
    <div className="timeline-wrap">
      <div className="timeline" dir="ltr" onClick={click} role={onSeek ? "button" : undefined}
           aria-label="Attention along the content. Click to jump to a point">
        {readings.map((r, i) => {
          const start = Math.max(0, r.position - windowLen);
          const left = (start / total) * 100;
          const width = Math.max(((r.position - start) / total) * 100, 0.6);
          return (
            <span key={i} className="seg" title={`${formatPosition(r.position, contentType)} · ${Math.round(r.score * 100)}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: scoreLevel(r.score).color }} />
          );
        })}
        {driftPoints.map((p, i) => (
          <span key={`d${i}`} className="drift-mark" style={{ left: `${(p.position / total) * 100}%` }}
                title={`Rewind point: ${formatPosition(p.position, contentType)}`} />
        ))}
        {current != null && <span className="playhead" style={{ left: `${Math.min(100, (current / total) * 100)}%` }} />}
      </div>
      <div className="legend small muted">
        <span><i style={{ background: "#22c55e" }} /> Focused</span>
        <span><i style={{ background: "#f59e0b" }} /> Medium</span>
        <span><i style={{ background: "#ef4444" }} /> Low focus</span>
        <span><i className="drift-legend" /> Rewind point</span>
      </div>
    </div>
  );
}
