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
    ? "Your account was created! You can log in now."
    : params.get("expired")
    ? "Your login has expired. Please log in again."
    : params.get("loggedout")
    ? "You have logged out."
    : params.get("deleted")
    ? "Your account and all its data were deleted."
    : "";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Please enter your email and password.");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/library", { replace: true });
    } catch (err) {
      if (err.status === 401) setError("Wrong email or password.");
      else if (err.status === 429) setError("Too many wrong attempts. Please try again in 15 minutes.");
      else if (err.status === 422) setError("This email address is not valid.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>Log in</h1>
      <Alert type="success">{info}</Alert>
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" dir="ltr" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" dir="ltr" autoComplete="current-password" value={password}
               onChange={(e) => setPassword(e.target.value)} />
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      </form>
      <p className="muted center">Don't have an account? <Link to="/register">Sign up</Link></p>
    </section>
  );
}
