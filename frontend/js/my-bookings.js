/**
 * my-bookings.js – User booking history + cancellation
 */

async function initMyBookings() {
    const list = document.getElementById("bookingsList");
    list.innerHTML = `<div class="loading-spinner"><span class="spinner"></span> Loading your bookings…</div>`;

    try {
        const res = await apiFetch("/my-bookings");
        const bookings = res.data || [];

        if (!bookings.length) {
            list.innerHTML = `<div class="no-data">📭 No bookings yet. <a href="#" onclick="window.navigateTo('booking')">Book your first slot!</a></div>`;
            return;
        }

        const statusClass = {
            "Confirmed": "status-confirmed",
            "Cancelled": "status-cancelled",
            "Late Cancellation": "status-late",
            "Completed": "status-completed",
        };

        list.innerHTML = bookings.map(b => {
            const canCancel = b.status === "Confirmed";
            const startShort = (b.start_time || "").slice(0, 5);
            const endShort = (b.end_time || "").slice(0, 5);
            return `
        <div class="booking-card" id="booking-${b.booking_id}">
          <div class="booking-card-header">
            <div>
              <div class="booking-station">${b.station_name}</div>
              <div class="booking-date">📅 ${b.booking_date}</div>
            </div>
            <span class="status-badge ${statusClass[b.status] || "status-confirmed"}">${b.status}</span>
          </div>
          <div class="booking-detail">
            <span class="booking-detail-item">📌 ${b.location}</span>
            <span class="booking-detail-item">🔌 Point #${b.point_id}</span>
            <span class="booking-detail-item">🕐 ${startShort} – ${endShort}</span>
          </div>
          ${canCancel ? `
            <button class="btn btn-danger btn-sm btn-full" onclick="cancelBooking(${b.booking_id})">
              ✖ Cancel Booking
            </button>` : ""}
        </div>`;
        }).join("");
    } catch (err) {
        list.innerHTML = `<div class="no-data">⚠️ ${err.message}</div>`;
    }
}

async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
        const res = await apiFetch(`/cancel-booking/${bookingId}`, { method: "DELETE" });
        const statusLabels = {
            "Cancelled": ["status-confirmed", "status-cancelled"],
            "Late Cancellation": ["status-confirmed", "status-late"],
        };
        const [oldCls, newCls] = statusLabels[res.status] || ["status-confirmed", "status-cancelled"];
        const card = document.getElementById(`booking-${bookingId}`);
        if (card) {
            card.querySelector(".status-badge").className = `status-badge ${newCls}`;
            card.querySelector(".status-badge").textContent = res.status;
            card.querySelector(".btn-danger")?.remove();
        }
        showToast(res.message, res.status === "Cancelled" ? "success" : "warning");
    } catch (err) {
        showToast(err.message, "error");
    }
}
