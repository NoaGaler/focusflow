// Bar chart of the attention score over a session (plain SVG, no chart library).
import { formatPosition, LOW_FOCUS, scoreLevel } from "../utils";

export default function FocusChart({ readings, contentType, height = 220 }) {
  if (!readings.length) return <p className="muted">No readings in this session.</p>;
  const W = 800, H = height, padL = 44, padB = 26, padT = 10;
  const plotW = W - padL - 10, plotH = H - padB - padT;
  const barW = Math.max(2, Math.min(28, plotW / readings.length - 2));
  const step = plotW / readings.length;
  const y = (s) => padT + plotH * (1 - s);
  const labelEvery = Math.ceil(readings.length / 8);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" dir="ltr"
         aria-label={`Attention chart: ${readings.length} readings`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 10} y1={y(t)} y2={y(t)} className="grid" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis">{Math.round(t * 100)}</text>
        </g>
      ))}
      <line x1={padL} x2={W - 10} y1={y(LOW_FOCUS)} y2={y(LOW_FOCUS)} className="threshold" />
      {readings.map((r, i) => (
        <g key={i}>
          <rect x={padL + i * step + (step - barW) / 2} y={y(r.score)} width={barW} height={plotH * r.score}
                fill={scoreLevel(r.score).color} rx="2">
            <title>{`${formatPosition(r.position, contentType)}: ${Math.round(r.score * 100)}`}</title>
          </rect>
          {i % labelEvery === 0 && (
            <text x={padL + i * step + step / 2} y={H - 8} textAnchor="middle" className="axis">
              {contentType === "text" ? `${Math.round(r.position)}%` : formatPosition(r.position)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
