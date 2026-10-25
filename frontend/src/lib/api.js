import { readStored, writeStored } from "./useStoredState";

export const AUTH_KEY = "catotag.auth"; // { token, username }

// Default: the backend on port 8000 of the host serving the page, so a phone on the LAN reaches the Mac.
// "localhost" may resolve to IPv6 while the dev server listens on IPv4 only.
const apiHost = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
export const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${apiHost}:8000`;

const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status; // 0 = network error / server unreachable
    this.detail = detail;
  }
}

export const getAuth = () => readStored(AUTH_KEY, null);
export const setAuth = (auth) => writeStored(AUTH_KEY, auth);
export const clearAuth = () => writeStored(AUTH_KEY, undefined);

const errorMessage = (status, detail) => {
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  return `Request failed (${status})`;
};

export async function api(path, { method = "GET", body, form, auth = true } = {}) {
  const token = auth ? getAuth()?.token : null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload, signal: controller.signal });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Expired or revoked session: sign out locally (data on this device is kept)
    if (res.status === 401 && token) clearAuth();
    throw new ApiError(res.status, errorMessage(res.status, data?.detail), data?.detail);
  }
  return data;
}

export async function login(username, password) {
  const res = await api("/api/token", { method: "POST", form: { username, password }, auth: false });
  setAuth({ token: res.access_token, username });
}

export async function register(username, email, password) {
  await api("/users/", { method: "POST", body: { username, email, password }, auth: false });
  await login(username, password);
}
