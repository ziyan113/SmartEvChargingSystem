/**
 * notifications.js – Alert system for upcoming bookings
 */

let _notifInterval = null;

async function initNotifications() {
    if (!("Notification" in window)) {
        console.warn("Browser does not support notifications.");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
        if (_notifInterval) clearInterval(_notifInterval);
        _notifInterval = setInterval(checkUpcomingBookings, 60 * 1000);
        // run once immediately
        checkUpcomingBookings();
    }
}

// Track notified slots to avoid spamming
const notified15Min = new Set();
const notifiedNow = new Set();

async function checkUpcomingBookings() {
    try {
        const res = await apiFetch("/my-bookings");
        const bookings = res.data || [];

        const now = new Date();

        bookings.forEach(b => {
            if (b.status !== "Confirmed") return;

            // start_time is like "08:00:00" or "08:00:00"
            // booking_date is like "2026-04-26" or "2026-04-26T00:00:00"
            const bDateStr = b.booking_date.split("T")[0];
            const slotStartStr = `${bDateStr}T${b.start_time}`;

            const slotTime = new Date(slotStartStr);
            if (isNaN(slotTime.getTime())) return;

            const diffMins = (slotTime - now) / 60000;

            if (diffMins > 0 && diffMins <= 15 && !notified15Min.has(b.booking_id)) {
                notified15Min.add(b.booking_id);
                new Notification("EV Charging Reminder ⚡", {
                    body: `Your charging slot at ${b.station_name} (Point #${b.point_id}) starts in 15 minutes!`,
                    icon: "https://cdn-icons-png.flaticon.com/512/3586/3586095.png"
                });
            } else if (diffMins > -1 && diffMins <= 0 && !notifiedNow.has(b.booking_id)) {
                notifiedNow.add(b.booking_id);
                new Notification("EV Charging Slot Started ⚡", {
                    body: `Your time slot at ${b.station_name} has just started.`,
                    icon: "https://cdn-icons-png.flaticon.com/512/3586/3586095.png"
                });
            }
        });
    } catch (err) {
        console.error("Notifications check failed:", err.message);
    }
}

// Expose globally
window.initNotifications = initNotifications;
