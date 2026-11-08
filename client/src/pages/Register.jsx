import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";

export function passwordProblem(pw) {
  if (pw.length < 8) return "הסיסמה צריכה להכיל לפחות 8 תווים.";
  if (!/[A-Za-z֐-׿]/.test(pw) || !/\d/.test(pw)) return "הסיסמה צריכה להכיל לפחות אות אחת וספרה אחת.";
  if (new TextEncoder().encode(pw).length > 72) return "הסיסמה ארוכה מדי.";
  return "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const email = form.email.trim();
    if (!form.display_name.trim()) return setError("יש למלא שם תצוגה.");
    if (!EMAIL_RE.test(email)) return setError("כתובת האימייל לא תקינה.");
    const pwErr = passwordProblem(form.password);
    if (pwErr) return setError(pwErr);
    if (form.password !== form.confirm) return setError("הסיסמאות לא זהות.");

    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: { email, password: form.password, display_name: form.display_name.trim() },
      });
      navigate(`/login?registered=1&email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err.status === 409) setError("כבר קיים חשבון עם האימייל הזה. אפשר להתחבר במקום.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>הרשמה</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor="display_name">שם תצוגה</label>
        <input id="display_name" autoComplete="nickname" value={form.display_name} onChange={set("display_name")} maxLength={50} />
        <label htmlFor="email">אימייל</label>
        <input id="email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
        <label htmlFor="password">סיסמה</label>
        <input id="password" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={set("password")} />
        <small className="hint">לפחות 8 תווים, עם אות אחת וספרה אחת לפחות.</small>
        <label htmlFor="confirm">אימות סיסמה</label>
        <input id="confirm" type="password" dir="ltr" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "נרשם..." : "יצירת חשבון"}</button>
      </form>
      <p className="muted center">כבר יש לך חשבון? <Link to="/login">להתחברות</Link></p>
    </section>
  );
}
