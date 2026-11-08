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
    if (!name.trim()) return setNameMsg({ error: "The name cannot be empty." });
    try {
      setUser(await api("/users/me", { method: "PATCH", body: { display_name: name.trim() } }));
      setNameMsg({ ok: "Name updated." });
    } catch (err) {
      setNameMsg({ error: err.message });
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    const problem = passwordProblem(pw.next);
    if (!pw.current) return setPwMsg({ error: "Please enter your current password." });
    if (problem) return setPwMsg({ error: problem });
    if (pw.next !== pw.confirm) return setPwMsg({ error: "The new passwords do not match." });
    try {
      await api("/users/me/password", { method: "POST", body: { current_password: pw.current, new_password: pw.next } });
      // The server cancels all old tokens -> log in again with the new password.
      logoutLocal();
      navigate(`/login?email=${encodeURIComponent(user.email)}`, { replace: true });
    } catch (err) {
      setPwMsg({ error: err.status === 400 ? "Your current password is wrong." : err.message });
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account? All your content and sessions will be deleted permanently and cannot be recovered.")) return;
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
      <h1>My profile</h1>
      <div className="card">
        <p><strong>Email:</strong> <span dir="ltr">{user.email}</span></p>
        <p className="muted">Member since {formatDate(user.created_at)}</p>
        <form onSubmit={saveName} className="row-form">
          <label htmlFor="pname">Display name</label>
          <input id="pname" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary">Save name</button>
        </form>
        <Alert>{nameMsg.error}</Alert>
        <Alert type="success">{nameMsg.ok}</Alert>
      </div>

      <div className="card">
        <h2>Change password</h2>
        <form onSubmit={changePassword}>
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" dir="ltr" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <label htmlFor="new">New password</label>
          <input id="new" type="password" dir="ltr" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <small className="hint">At least 8 characters, with a letter and a digit. You will be asked to log in again afterwards.</small>
          <label htmlFor="conf">Confirm new password</label>
          <input id="conf" type="password" dir="ltr" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          <Alert>{pwMsg.error}</Alert>
          <button className="btn btn-primary">Change password</button>
        </form>
      </div>

      <div className="card danger-zone">
        <h2>Delete account</h2>
        <p>Deletes your account, all your content items and your whole session history.</p>
        <Alert>{delMsg}</Alert>
        <button className="btn btn-danger" onClick={deleteAccount}>Delete my account permanently</button>
      </div>
    </section>
  );
}
