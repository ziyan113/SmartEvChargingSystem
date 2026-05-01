/**
 * admin.js – Admin dashboard page
 * Handles: add station, add charging point, view all bookings, stats
 */

async function initAdmin() {
    await Promise.all([loadAdminStats(), loadAdminBookings(), loadAdminStationDropdown()]);
    wireAdminForms();
}

async function loadAdminStats() {
    try {
        const stRes = await apiFetch("/stations");
        const bkRes = await apiFetch("/admin/bookings");

        const stations = stRes.data || [];
        const bookings = bkRes.data || [];
        const active = bookings.filter(b => b.status === "Confirmed").length;

        document.getElementById("totalStations").textContent = stations.length;
        document.getElementById("totalBookings").textContent = bookings.length;
        document.getElementById("activeBookings").textContent = active;
    } catch (err) {
        showToast("Could not load stats: " + err.message, "error");
    }
}

async function loadAdminBookings() {
    const tbody = document.getElementById("adminBookingsBody");
    try {
        const res = await apiFetch("/admin/bookings");
        const bookings = res.data || [];

        if (!bookings.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No bookings yet.</td></tr>`;
            return;
        }

        const statusClass = {
            "Confirmed": "status-confirmed",
            "Cancelled": "status-cancelled",
            "Late Cancellation": "status-late",
            "Completed": "status-completed",
        };

        tbody.innerHTML = bookings.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div style="font-weight:600">${b.user_name || b.user_id}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${b.email || ""}</div>
        </td>
        <td>${b.station_name}<br><small style="color:var(--text-muted)">${b.location}</small></td>
        <td>#${b.point_id}</td>
        <td>${b.booking_date}</td>
        <td>${(b.start_time || "").slice(0, 5)} – ${(b.end_time || "").slice(0, 5)}</td>
        <td><span class="status-badge ${statusClass[b.status] || "status-confirmed"}">${b.status}</span></td>
      </tr>`).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">⚠️ ${err.message}</td></tr>`;
    }
}

async function loadAdminStationDropdown() {
    const sel = document.getElementById("adminPointStation");
    try {
        const res = await apiFetch("/stations");
        sel.innerHTML = '<option value="">-- Select Station --</option>';
        (res.data || []).forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.station_id;
            opt.textContent = s.station_name;
            sel.appendChild(opt);
        });
    } catch { }
}

function wireAdminForms() {
    // Add Station
    document.getElementById("addStationBtn")?.addEventListener("click", async () => {
        const name = document.getElementById("adminStationName").value.trim();
        const location = document.getElementById("adminLocation").value.trim();
        const lat = parseFloat(document.getElementById("adminLat").value);
        const lng = parseFloat(document.getElementById("adminLng").value);

        if (!name || !location || isNaN(lat) || isNaN(lng)) {
            showToast("Please fill all station fields.", "warning"); return;
        }
        try {
            await apiFetch("/admin/stations", {
                method: "POST",
                body: JSON.stringify({ station_name: name, location, latitude: lat, longitude: lng }),
            });
            showToast(`✅ Station "${name}" added!`, "success");
            ["adminStationName", "adminLocation", "adminLat", "adminLng"].forEach(id => { document.getElementById(id).value = ""; });
            await loadAdminStats();
            await loadAdminStationDropdown();
            _stationsLoaded = false;  // reset stations page cache
        } catch (err) { showToast(err.message, "error"); }
    });

    // Add Charging Point
    document.getElementById("addPointBtn")?.addEventListener("click", async () => {
        const stationId = document.getElementById("adminPointStation").value;
        if (!stationId) { showToast("Select a station first.", "warning"); return; }
        try {
            const res = await apiFetch("/admin/points", {
                method: "POST",
                body: JSON.stringify({ station_id: parseInt(stationId) }),
            });
            showToast(`✅ Charging Point #${res.data.point_id} added!`, "success");
            await loadAdminStats();
        } catch (err) { showToast(err.message, "error"); }
    });
}
