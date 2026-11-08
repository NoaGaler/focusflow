// All calls to the server go through here.
// The address is relative ("/api"), so the same build works locally (nginx forwards
// /api to the server container) and in the cloud (the Load Balancer does it).
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "focusflow_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = "GET", body, auth = true, keepalive = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your internet connection and try again.");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth && token) onUnauthorized(); // token expired / revoked
    const detail = typeof data.detail === "string" ? data.detail : "";
    throw new ApiError(res.status, detail || `Server error (${res.status})`);
  }
  return data;
}
