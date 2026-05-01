/**
 * app.js – SPA router + sidebar toggle
 * Auth gate: checks login before showing app pages.
 */

document.addEventListener("DOMContentLoaded", async () => {

    // ── Authenticate ────────────────────────────────────────────
    const authenticated = await initAuth();
    if (!authenticated) return;   // stops here if not logged in

    // Initialize notification system
    if (typeof initNotifications === "function") {
        initNotifications();
    }

    // ── Sidebar collapse ─────────────────────────────────────────
    const sidebar = document.getElementById("sidebar");
    document.getElementById("sidebarToggle")?.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // ── Page routing ─────────────────────────────────────────────
    const pages = document.querySelectorAll(".page");
    const navLinks = document.querySelectorAll(".nav-link");

    function navigateTo(pageId) {
        // Guard admin page for non-admins
        if (pageId === "admin" && !isAdmin()) {
            showToast("Admin access required.", "error");
            return;
        }

        pages.forEach(p => p.classList.remove("active"));
        navLinks.forEach(l => l.classList.remove("active"));

        const targetPage = document.getElementById(`page-${pageId}`);
        const targetLink = document.getElementById(`nav-${pageId}`);
        if (targetPage) targetPage.classList.add("active");
        if (targetLink) targetLink.classList.add("active");

        switch (pageId) {
            case "dashboard": initDashboard(); break;
            case "stations": initStations(); break;
            case "booking": initBookingPage(); break;
            case "my-bookings": initMyBookings(); break;
            case "calculator":  /* static */       break;
            case "admin": initAdmin(); break;
        }
    }

    navLinks.forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Expose globally (other modules use this)
    window.navigateTo = navigateTo;

    // Boot to dashboard
    navigateTo("dashboard");
});
