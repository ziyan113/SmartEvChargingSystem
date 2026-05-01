/**
 * auth.js – Login/logout, session management, role-based nav
 */

/* ── Current user (populated after login) ─────────────────── */
let currentUser = null;

function getCurrentUser() {
    if (currentUser) return currentUser;
    try {
        const stored = localStorage.getItem("ev_user");
        currentUser = stored ? JSON.parse(stored) : null;
    } catch { currentUser = null; }
    return currentUser;
}

function isAdmin() {
    const u = getCurrentUser();
    return u && u.role === "admin";
}

/* ── Bootstrap auth on page load ──────────────────────────── */
async function initAuth() {
    const token = localStorage.getItem("ev_token");
    if (!token) {
        showLoginScreen();
        return false;
    }

    try {
        // Verify token is still valid
        const res = await apiFetch("/auth/me");
        currentUser = res.data;
        localStorage.setItem("ev_user", JSON.stringify(currentUser));
        showAppShell();
        return true;
    } catch {
        // Token invalid → show login
        localStorage.removeItem("ev_token");
        localStorage.removeItem("ev_user");
        showLoginScreen();
        return false;
    }
}

function showLoginScreen() {
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("appShell").style.display = "none";
}

function showAppShell() {
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appShell").style.display = "flex";

    const user = getCurrentUser();
    if (!user) return;

    // Populate sidebar user info
    document.getElementById("userName").textContent = user.name;
    document.getElementById("userRole").textContent = user.role === "admin" ? "🔧 Admin" : "👤 User";
    document.getElementById("userAvatar").textContent = user.name.slice(0, 2).toUpperCase();

    // Show admin nav item for admins, hide for regular users
    document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = user.role === "admin" ? "block" : "none";
    });
}

/* ── Wire up auth forms ────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    const tabLogin = document.getElementById("tabLogin");
    const tabSignup = document.getElementById("tabSignup");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const errorEl = document.getElementById("authError");
    const logoutBtn = document.getElementById("logoutBtn");

    // Tab switching
    tabLogin?.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        loginForm.style.display = "block";
        signupForm.style.display = "none";
        errorEl.style.display = "none";
    });

    tabSignup?.addEventListener("click", () => {
        tabSignup.classList.add("active");
        tabLogin.classList.remove("active");
        signupForm.style.display = "block";
        loginForm.style.display = "none";
        errorEl.style.display = "none";
    });

    // Login Form Submit
    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const btn = document.getElementById("loginBtn");

        if (!email || !password) return;

        errorEl.style.display = "none";
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>';

        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "Login failed.");
            }

            const { token, ...user } = json.data;
            currentUser = user;
            localStorage.setItem("ev_token", token);
            localStorage.setItem("ev_user", JSON.stringify(user));

            showAppShell();
            window.navigateTo(user.role === "admin" ? "admin" : "dashboard");
            showToast("Successfully signed in", "success");
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = "block";
        } finally {
            btn.disabled = false;
            btn.textContent = "Sign In";
        }
    });

    // Signup Form Submit
    signupForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const phone = document.getElementById("signupPhone").value.trim();
        const password = document.getElementById("signupPassword").value;
        const btn = document.getElementById("signupBtn");

        if (!name || !email || !password) return;

        // Strict phone validation (+91 followed by EXACTLY 10 digits)
        const phoneRegex = /^\+91\s?\d{10}$/;
        if (phone && !phoneRegex.test(phone)) {
            errorEl.textContent = "Invalid phone number. Country code (+91) must be followed by exactly 10 digits.";
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = "Create Account";
            return;
        }

        errorEl.style.display = "none";
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>';

        try {
            const res = await fetch(`${BASE_URL}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, password }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "Signup failed.");
            }

            const { token, ...user } = json.data;
            currentUser = user;
            localStorage.setItem("ev_token", token);
            localStorage.setItem("ev_user", JSON.stringify(user));

            showAppShell();
            window.navigateTo("dashboard");
            showToast("Account created successfully", "success");
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = "block";
        } finally {
            btn.disabled = false;
            btn.textContent = "Create Account";
        }
    });

    // Logout
    logoutBtn?.addEventListener("click", async () => {
        try { await apiFetch("/auth/logout", { method: "POST" }); } catch { }
        localStorage.removeItem("ev_token");
        localStorage.removeItem("ev_user");
        currentUser = null;
        showLoginScreen();
    });
});
