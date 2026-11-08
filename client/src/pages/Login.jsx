import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import Alert from "../components/Alert";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const info = params.get("registered")
    ? "נרשמת בהצלחה! עכשיו אפשר להתחבר."
    : params.get("expired")
    ? "ההתחברות פגה. יש להתחבר שוב."
    : params.get("loggedout")
    ? "התנתקת בהצלחה."
    : params.get("deleted")
    ? "החשבון וכל הנתונים שלו נמחקו."
    : "";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("יש למלא אימייל וסיסמה.");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/library", { replace: true });
    } catch (err) {
      if (err.status === 401) setError("אימייל או סיסמה שגויים.");
      else if (err.status === 429) setError("יותר מדי ניסיונות שגויים. נסו שוב בעוד 15 דקות.");
      else if (err.status === 422) setError("כתובת האימייל לא תקינה.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>התחברות</h1>
      <Alert type="success">{info}</Alert>
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">אימייל</label>
        <input id="email" type="email" dir="ltr" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <label htmlFor="password">סיסמה</label>
        <input id="password" type="password" dir="ltr" autoComplete="current-password" value={password}
               onChange={(e) => setPassword(e.target.value)} />
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "מתחבר..." : "התחברות"}</button>
      </form>
      <p className="muted center">אין לך חשבון? <Link to="/register">להרשמה</Link></p>
    </section>
  );
}
