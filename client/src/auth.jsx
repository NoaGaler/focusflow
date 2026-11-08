import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setUnauthorizedHandler, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logoutLocal = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // When the server says 401 (expired/revoked token) -> back to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logoutLocal();
      navigate("/login?expired=1", { replace: true });
    });
  }, [logoutLocal, navigate]);

  // On page load (or refresh), check that the saved token still works.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api("/users/me")
      .then(setUser)
      .catch(() => logoutLocal())
      .finally(() => setLoading(false));
  }, [logoutLocal]);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password }, auth: false });
    tokenStore.set(data.access_token);
    const me = await api("/users/me");
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* the token is removed locally anyway */
    }
    logoutLocal();
    navigate("/login?loggedout=1");
  }, [logoutLocal, navigate]);

  const value = useMemo(
    () => ({ user, setUser, loading, login, logout, logoutLocal }),
    [user, loading, login, logout, logoutLocal]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
