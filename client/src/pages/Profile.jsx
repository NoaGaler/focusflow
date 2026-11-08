import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Alert from "../components/Alert";
import { formatDate } from "../utils";
import { passwordProblem } from "./Register";

export default function Profile() {
  const { user, setUser, logoutLocal } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.display_name);
  const [nameMsg, setNameMsg] = useState({});
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({});
  const [delMsg, setDelMsg] = useState("");

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim()) return setNameMsg({ error: "השם לא יכול להיות ריק." });
    try {
      setUser(await api("/users/me", { method: "PATCH", body: { display_name: name.trim() } }));
      setNameMsg({ ok: "השם עודכן." });
    } catch (err) {
      setNameMsg({ error: err.message });
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    const problem = passwordProblem(pw.next);
    if (!pw.current) return setPwMsg({ error: "יש להזין את הסיסמה הנוכחית." });
    if (problem) return setPwMsg({ error: problem });
    if (pw.next !== pw.confirm) return setPwMsg({ error: "הסיסמאות החדשות לא זהות." });
    try {
      await api("/users/me/password", { method: "POST", body: { current_password: pw.current, new_password: pw.next } });
      // The server cancels all old tokens -> log in again with the new password.
      logoutLocal();
      navigate(`/login?email=${encodeURIComponent(user.email)}`, { replace: true });
    } catch (err) {
      setPwMsg({ error: err.status === 400 ? "הסיסמה הנוכחית שגויה." : err.message });
    }
  }

  async function deleteAccount() {
    if (!window.confirm("למחוק את החשבון? כל התוכן וכל הסשנים יימחקו לצמיתות, ואין דרך לשחזר אותם.")) return;
    try {
      await api("/users/me", { method: "DELETE" });
      logoutLocal();
      navigate("/login?deleted=1", { replace: true });
    } catch (err) {
      setDelMsg(err.message);
    }
  }

  return (
    <section className="stack">
      <h1>הפרופיל שלי</h1>
      <div className="card">
        <p><strong>אימייל:</strong> <span dir="ltr">{user.email}</span></p>
        <p className="muted">נרשמת בתאריך {formatDate(user.created_at)}</p>
        <form onSubmit={saveName} className="row-form">
          <label htmlFor="pname">שם תצוגה</label>
          <input id="pname" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary">שמירת שם</button>
        </form>
        <Alert>{nameMsg.error}</Alert>
        <Alert type="success">{nameMsg.ok}</Alert>
      </div>

      <div className="card">
        <h2>החלפת סיסמה</h2>
        <form onSubmit={changePassword}>
          <label htmlFor="cur">סיסמה נוכחית</label>
          <input id="cur" type="password" dir="ltr" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <label htmlFor="new">סיסמה חדשה</label>
          <input id="new" type="password" dir="ltr" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <small className="hint">לפחות 8 תווים, עם אות וספרה. אחרי ההחלפה תתבקשו להתחבר מחדש.</small>
          <label htmlFor="conf">אימות סיסמה חדשה</label>
          <input id="conf" type="password" dir="ltr" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          <Alert>{pwMsg.error}</Alert>
          <button className="btn btn-primary">החלפת סיסמה</button>
        </form>
      </div>

      <div className="card danger-zone">
        <h2>מחיקת חשבון</h2>
        <p>מוחק את החשבון, את כל פריטי התוכן ואת כל היסטוריית הסשנים.</p>
        <Alert>{delMsg}</Alert>
        <button className="btn btn-danger" onClick={deleteAccount}>מחיקת החשבון לצמיתות</button>
      </div>
    </section>
  );
}
