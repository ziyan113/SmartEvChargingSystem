/**
 * stations.js – All stations table
 */

let _stationsLoaded = false;

async function initStations() {
    if (_stationsLoaded) return;
    _stationsLoaded = true;

    const tbody = document.getElementById("stationsTableBody");
    try {
        const res = await apiFetch("/stations");
        const stations = res.data || [];

        if (!stations.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No stations found.</td></tr>`;
            return;
        }

        tbody.innerHTML = stations.map((s, i) => {
            const avail = s.available_points ?? 0;
            const total = s.total_points ?? 0;
            const availCls = avail === 0 ? "none" : avail <= 1 ? "low" : "";
            return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${s.station_name}</strong></td>
          <td>${s.location}</td>
          <td>${total}</td>
          <td><span class="avail-count ${availCls}">${avail}</span></td>
          <td>
            <button class="btn btn-primary btn-xs"
              onclick="window.navigateTo('booking'); setTimeout(()=>{ document.getElementById('bookStationSelect').value='${s.station_id}'; document.getElementById('bookStationSelect').dispatchEvent(new Event('change')); }, 150)">
              Book →
            </button>
          </td>
        </tr>`;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row">⚠️ ${err.message}</td></tr>`;
    }
}
