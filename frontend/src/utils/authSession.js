export function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenValid(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

export function getAuthToken() {
  const token = localStorage.getItem("token");
  if (!isTokenValid(token)) {
    clearSession();
    return null;
  }
  return token;
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

