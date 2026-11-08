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
      return setError("This does not look like a YouTube link. Example: https://www.youtube.com/watch?v=...");
    if (type === "text" && src.length < 20) return setError("The text is too short (at least 20 characters).");
    const finalTitle = title.trim() || (type === "youtube" ? "YouTube video" : src.slice(0, 40) + "...");
    setBusy(true);
    try {
      const item = await api("/content", { method: "POST", body: { type, title: finalTitle, source: src } });
      setTitle("");
      setSource("");
      onAdded(item);
    } catch (err) {
      setError(err.status === 422 ? `The item was not saved: ${err.message}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card add-form" onSubmit={submit} noValidate>
      <h2>Add content</h2>
      <div className="type-switch" role="radiogroup" aria-label="Content type">
        <label className={type === "youtube" ? "active" : ""}>
          <input type="radio" name="type" value="youtube" checked={type === "youtube"} onChange={() => setType("youtube")} />
          YouTube video
        </label>
        <label className={type === "text" ? "active" : ""}>
          <input type="radio" name="type" value="text" checked={type === "text"} onChange={() => setType("text")} />
          Text to read
        </label>
      </div>
      <label htmlFor="title">Title {type === "youtube" && <span className="muted">(optional)</span>}</label>
      <input id="title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
             placeholder={type === "youtube" ? "e.g. Lecture on algorithms" : "e.g. An article about memory"} />
      {type === "youtube" ? (
        <>
          <label htmlFor="source">Video link</label>
          <input id="source" dir="ltr" value={source} onChange={(e) => setSource(e.target.value)}
                 placeholder="https://www.youtube.com/watch?v=..." />
        </>
      ) : (
        <>
          <label htmlFor="source">Text</label>
          <textarea id="source" rows={6} value={source} onChange={(e) => setSource(e.target.value)}
                    placeholder="Paste the text you want to read here" />
        </>
      )}
      <Alert>{error}</Alert>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Adding..." : "Add to library"}</button>
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
    if (!window.confirm(`Delete "${item.title}" from your library?`)) return;
    try {
      await api(`/content/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice(`"${item.title}" was deleted.`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="stack">
      <h1>My library</h1>
      <AddContentForm onAdded={(item) => { setItems((l) => [item, ...(l || [])]); setNotice(`"${item.title}" was added. Click "Start session" to begin.`); }} />
      <Alert type="success">{notice}</Alert>
      <Alert>{error}</Alert>
      {items === null && !error && <p className="muted">Loading your library...</p>}
      {items?.length === 0 && (
        <div className="card empty">
          <p><strong>Your library is empty.</strong></p>
          <p className="muted">Add a YouTube link or a text using the form above, then start a session.</p>
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
                <span className="tag">{item.type === "youtube" ? "Video" : "Text"}</span>
                <h3 title={item.title}>{item.title}</h3>
                <span className="muted small">Added {formatDate(item.created_at)}</span>
              </div>
              <div className="card-actions">
                <Link className="btn btn-primary" to={`/watch/${item.id}`}>Start session</Link>
                <button className="btn btn-ghost" onClick={() => remove(item)} aria-label={`Delete ${item.title}`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
