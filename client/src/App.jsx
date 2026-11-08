import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Library from "./pages/Library";
import Watch from "./pages/Watch";
import History from "./pages/History";
import SessionDetail from "./pages/SessionDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted">טוען...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">טוען...</p>;
  return user ? <Navigate to="/library" replace /> : children;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<GuestOnly><Home /></GuestOnly>} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/library" element={<Protected><Library /></Protected>} />
        <Route path="/watch/:contentId" element={<Protected><Watch /></Protected>} />
        <Route path="/history" element={<Protected><History /></Protected>} />
        <Route path="/history/:sessionId" element={<Protected><SessionDetail /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
