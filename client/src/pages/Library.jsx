import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";
import { formatDate } from "../utils";

const YT_RE = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function AddContentForm({ onAdded }) {
  const [type, setType] = useState("youtube");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const src = source.trim();
    if (type === "youtube" && !YT_RE.test(src))
      return setError("זה לא נראה כמו קישור ל-YouTube. דוגמה: https://www.youtube.com/watch?v=...");
    if (type === "text" && src.length < 20) return setError("הטקסט קצר מדי (לפחות 20 תווים).");
    const finalTitle = title.trim() || (type === "youtube" ? "סרטון YouTube" : src.slice(0, 40) + "...");
    setBusy(true);
    try {
      const item = await api("/content", { method: "POST", body: { type, title: finalTitle, source: src } });
      setTitle("");
      setSource("");
      onAdded(item);
    } catch (err) {
      setError(err.status === 422 ? `הפריט לא נשמר: ${err.message}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card add-form" onSubmit={submit} noValidate>
      <h2>הוספת תוכן</h2>
      <div className="type-switch" role="radiogroup" aria-label="סוג התוכן">
        <label className={type === "youtube" ? "active" : ""}>
          <input type="radio" name="type" value="youtube" checked={type === "youtube"} onChange={() => setType("youtube")} />
          סרטון YouTube
        </label>
        <label className={type === "text" ? "active" : ""}>
          <input type="radio" name="type" value="text" checked={type === "text"} onChange={() => setType("text")} />
          טקסט לקריאה
        </label>
      </div>
      <label htmlFor="title">כותרת {type === "youtube" && <span className="muted">(לא חובה)</span>}</label>
      <input id="title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
             placeholder={type === "youtube" ? "למשל: הרצאה על אלגוריתמים" : "למשל: מאמר על זיכרון"} />
      {type === "youtube" ? (
        <>
          <label htmlFor="source">קישור לסרטון</label>
          <input id="source" dir="ltr" value={source} onChange={(e) => setSource(e.target.value)}
                 placeholder="https://www.youtube.com/watch?v=..." />
        </>
      ) : (
        <>
          <label htmlFor="source">הטקסט</label>
          <textarea id="source" rows={6} value={source} onChange={(e) => setSource(e.target.value)}
                    placeholder="הדביקו כאן את הטקסט שתרצו לקרוא" />
        </>
      )}
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>{busy ? "מוסיף..." : "הוספה לספרייה"}</button>
    </form>
  );
}

export default function Library() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api("/content").then(setItems).catch((e) => setError(e.message));
  }, []);

  async function remove(item) {
    if (!window.confirm(`למחוק את "${item.title}" מהספרייה?`)) return;
    try {
      await api(`/content/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice(`"${item.title}" נמחק.`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="stack">
      <h1>הספרייה שלי</h1>
      <AddContentForm onAdded={(item) => { setItems((l) => [item, ...(l || [])]); setNotice(`"${item.title}" נוסף לספרייה. לחצו "התחלת סשן" כדי להתחיל.`); }} />
      <Alert type="success">{notice}</Alert>
      <Alert>{error}</Alert>
      {items === null && !error && <p className="muted">טוען את הספרייה...</p>}
      {items?.length === 0 && (
        <div className="card empty">
          <p><strong>הספרייה עדיין ריקה.</strong></p>
          <p className="muted">הוסיפו קישור לסרטון YouTube או טקסט בטופס שלמעלה, ואז התחילו סשן.</p>
        </div>
      )}
      {items?.length > 0 && (
        <ul className="content-grid">
          {items.map((item) => (
            <li key={item.id} className="card content-card">
              {item.type === "youtube" ? (
                <img className="thumb" src={`https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              ) : (
                <div className="thumb text-thumb" aria-hidden="true">{item.source.slice(0, 120)}</div>
              )}
              <div className="content-info">
                <span className="tag">{item.type === "youtube" ? "סרטון" : "טקסט"}</span>
                <h3 title={item.title}>{item.title}</h3>
                <span className="muted small">נוסף {formatDate(item.created_at)}</span>
              </div>
              <div className="card-actions">
                <Link className="btn btn-primary" to={`/watch/${item.id}`}>התחלת סשן</Link>
                <button className="btn btn-ghost" onClick={() => remove(item)} aria-label={`מחיקת ${item.title}`}>מחיקה</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
