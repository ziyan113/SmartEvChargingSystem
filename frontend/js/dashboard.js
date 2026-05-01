/**
 * dashboard.js – GPS nearby stations
 */

let _dashInit = false;

async function initDashboard() {
    if (_dashInit) return;
    _dashInit = true;

    document.getElementById("refreshLocation")?.addEventListener("click", () => {
        _dashInit = false;
        document.getElementById("nearbyStationsGrid").innerHTML =
            '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
        initDashboard();
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                document.getElementById("locationText").textContent =
                    `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                loadNearby(lat, lng);
            },
            () => {
                document.getElementById("locationText").textContent = "Location unavailable – showing all stations";
                loadNearby(13.0827, 80.2707); // Chennai default
            }
        );
    } else {
        document.getElementById("locationText").textContent = "GPS not supported – showing all stations";
        loadNearby(13.0827, 80.2707);
    }
}

async function loadNearby(lat, lng) {
    const grid = document.getElementById("nearbyStationsGrid");
    try {
        const res = await apiFetch(`/nearby-stations?lat=${lat}&lng=${lng}`);
        const stations = res.data || [];

        if (!stations.length) {
            grid.innerHTML = `<div class="no-data">No nearby stations found.</div>`;
            return;
        }

        grid.innerHTML = stations.map(s => {
            const avail = s.available_points ?? 0;
            const total = s.total_points ?? 0;
            const dotsFull = Math.min(total, 5);
            const dots = Array.from({ length: dotsFull }, (_, i) =>
                `<span class="dot ${i < avail ? "available" : "occupied"}"></span>`
            ).join("");
            const dist = s.distance_km !== undefined ? `${s.distance_km} km` : "";
            const availCls = avail === 0 ? "none" : avail <= 1 ? "low" : "";

            return `
        <div class="station-card">
          <div class="station-card-header">
            <div class="station-card-name">${s.station_name}</div>
            ${dist ? `<span class="distance-badge">📍 ${dist}</span>` : ""}
          </div>
          <div class="station-card-location">📌 ${s.location}</div>
          <div class="station-card-meta">
            <div class="avail-dots">${dots}</div>
            <span class="avail-label avail-count ${availCls}">${avail}/${total} available</span>
          </div>
          <button class="btn btn-primary btn-full btn-sm"
            onclick="window.navigateTo('booking'); setTimeout(()=>{ document.getElementById('bookStationSelect').value='${s.station_id}'; document.getElementById('bookStationSelect').dispatchEvent(new Event('change')); }, 150)">
            Book Slot →
          </button>
        </div>`;
        }).join("");
    } catch (err) {
        grid.innerHTML = `<div class="no-data">⚠️ ${err.message}</div>`;
    }
}
