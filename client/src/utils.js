// Small shared helpers: time format and the meaning of a score.

export const LOW_FOCUS = 0.4; // below this we show the "you drifted" alert

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Position label: seconds for video, percent for text. */
export function formatPosition(position, contentType) {
  return contentType === "text" ? `${Math.round(position)}% of the text` : formatTime(position);
}

export function scoreLevel(score) {
  if (score == null) return { key: "none", label: "No data", color: "#94a3b8" };
  if (score < LOW_FOCUS) return { key: "low", label: "Low focus", color: "#ef4444" };
  if (score < 0.6) return { key: "mid", label: "Medium focus", color: "#f59e0b" };
  return { key: "high", label: "Focused", color: "#22c55e" };
}

export function percent(score) {
  return score == null ? "—" : `${Math.round(score * 100)}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function durationBetween(startIso, endIso) {
  if (!startIso || !endIso) return "";
  return formatTime((new Date(endIso) - new Date(startIso)) / 1000);
}

/**
 * "Rewind points": the moments where focus dropped.
 * A drop starts at the first low reading after a non-low one. Each score describes
 * the 10 seconds BEFORE it, so we rewind to 10 seconds before that reading.
 */
export function findDriftPoints(readings, contentType = "youtube") {
  const points = [];
  let inLow = false;
  for (const r of readings) {
    const low = r.score < LOW_FOCUS;
    if (low && !inLow) {
      const back = contentType === "text" ? Math.max(0, r.position - 5) : Math.max(0, r.position - 10);
      // skip drops that are almost at the same place as the previous one
      if (!points.length || Math.abs(points[points.length - 1].position - back) > 3) {
        points.push({ position: back, score: r.score });
      }
    }
    inLow = low;
  }
  return points;
}
