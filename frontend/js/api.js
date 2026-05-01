/**
 * api.js – Shared API fetch helper with Bearer token auth
 */

const BASE_URL = "http://localhost:5000";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("ev_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const config = { ...options, headers };
  const res = await fetch(`${BASE_URL}${path}`, config);
  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    if (res.status === 401) {
      // Token expired or invalid → force logout
      doLogout();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] ?? "•"}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ── Thin logout helper (no UI dep) ─────────────────────────── */
function doLogout() {
  localStorage.removeItem("ev_token");
  localStorage.removeItem("ev_user");
  location.reload();
}
