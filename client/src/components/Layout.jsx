import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to={user ? "/library" : "/"} className="brand" aria-label="FocusFlow - home">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>FocusFlow</span>
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/library">My library</NavLink>
              <NavLink to="/history">History</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              <span className="hello" title={user.email}>Hi, {user.display_name}</span>
              <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">{children}</main>
      <footer className="footer muted">
        FocusFlow · The attention model runs in your browser. Camera images are never saved or sent anywhere.
      </footer>
    </>
  );
}
