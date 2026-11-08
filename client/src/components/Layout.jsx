import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to={user ? "/library" : "/"} className="brand" aria-label="FocusFlow - דף הבית">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>FocusFlow</span>
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/library">הספרייה שלי</NavLink>
              <NavLink to="/history">היסטוריה</NavLink>
              <NavLink to="/profile">פרופיל</NavLink>
              <span className="hello" title={user.email}>שלום, {user.display_name}</span>
              <button className="btn btn-ghost btn-sm" onClick={logout}>התנתקות</button>
            </>
          ) : (
            <>
              <NavLink to="/login">התחברות</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">הרשמה</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">{children}</main>
      <footer className="footer muted">
        FocusFlow · מודל הקשב רץ אצלך בדפדפן. התמונה מהמצלמה לא נשמרת ולא נשלחת לשום מקום.
      </footer>
    </>
  );
}
