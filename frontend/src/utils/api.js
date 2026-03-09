export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

