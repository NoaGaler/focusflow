import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Alert from "../components/Alert";

export function passwordProblem(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) return "Password must contain at least one letter and one digit.";
  if (new TextEncoder().encode(pw).length > 72) return "Password is too long.";
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
    if (!form.display_name.trim()) return setError("Please enter a display name.");
    if (!EMAIL_RE.test(email)) return setError("This email address is not valid.");
    const pwErr = passwordProblem(form.password);
    if (pwErr) return setError(pwErr);
    if (form.password !== form.confirm) return setError("The passwords do not match.");

    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: { email, password: form.password, display_name: form.display_name.trim() },
      });
      navigate(`/login?registered=1&email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (err.status === 409) setError("An account with this email already exists. You can log in instead.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>Sign up</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor="display_name">Display name</label>
        <input id="display_name" autoComplete="nickname" value={form.display_name} onChange={set("display_name")} maxLength={50} />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={set("password")} />
        <small className="hint">At least 8 characters, with at least one letter and one digit.</small>
        <label htmlFor="confirm">Confirm password</label>
        <input id="confirm" type="password" dir="ltr" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
      </form>
      <p className="muted center">Already have an account? <Link to="/login">Log in</Link></p>
    </section>
  );
}
