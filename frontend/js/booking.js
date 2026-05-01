/**
 * booking.js – Slot booking page
 * • Loads stations into dropdown
 * • Loading charging points for selected station
 * • Restricts date picker to today or future dates
 * • Marks past slots as unavailable visually
 * • Sends POST /book-slot with Bearer token
 */

let _selectedSlotId = null;
let _selectedPointId = null;
let _bookingFormLoaded = false;

function initBookingPage(prefillStation = null) {
    if (!_bookingFormLoaded) {
        loadBookingStations();
        setupBookingDateMin();
        wireBookingForm();
        _bookingFormLoaded = true;
    }
    if (prefillStation) {
        document.getElementById("bookStationSelect").value = prefillStation;
        document.getElementById("bookStationSelect").dispatchEvent(new Event("change"));
    }
}

function setupBookingDateMin() {
    const dateEl = document.getElementById("bookDate");
    if (!dateEl) return;
    const today = new Date();
    const diff = today.getTimezoneOffset() * 60000;
    const localToday = new Date(today.getTime() - diff).toISOString().split("T")[0];
    
    // Initialize flatpickr with DD-MM-YYYY format
    flatpickr(dateEl, {
        minDate: "today",
        defaultDate: localToday,
        altInput: true,
        altFormat: "d-m-Y",
        dateFormat: "Y-m-d",
        disableMobile: true
    });
}

async function loadBookingStations() {
    const sel = document.getElementById("bookStationSelect");
    try {
        const res = await apiFetch("/stations");
        sel.innerHTML = '<option value="">-- Select Station --</option>';
        (res.data || []).forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.station_id;
            opt.textContent = `${s.station_name} (${s.available_points} available)`;
            sel.appendChild(opt);
        });
    } catch (err) {
        showToast("Could not load stations: " + err.message, "error");
    }
}

async function loadBookingPoints(stationId) {
    const ptSel = document.getElementById("bookPointSelect");
    ptSel.innerHTML = '<option value="">Loading…</option>';
    ptSel.disabled = true;

    const d = new Date();
    const today = document.getElementById("bookDate").value || new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    try {
        const res = await apiFetch(`/slots/${stationId}?date=${today}`);
        const points = res.data || [];

        ptSel.innerHTML = '<option value="">-- Select Charging Point --</option>';
        points.forEach(pt => {
            const hasAvail = pt.slots.some(s => s.available);
            const opt = document.createElement("option");
            opt.value = pt.point_id;
            opt.textContent = `Point #${pt.point_id}${hasAvail ? " ✅" : " (no slots)"}`;
            opt.disabled = pt.status !== "Available";
            ptSel.appendChild(opt);
        });
        ptSel.disabled = false;
        checkLoadSlotsReady();
    } catch (err) {
        ptSel.innerHTML = '<option value="">Failed to load points</option>';
        showToast("Could not load charging points.", "error");
    }
}

function checkLoadSlotsReady() {
    const btn = document.getElementById("loadSlotsBtn");
    const st = document.getElementById("bookStationSelect").value;
    const pt = document.getElementById("bookPointSelect").value;
    const dt = document.getElementById("bookDate").value;
    btn.disabled = !(st && pt && dt);
}

function wireBookingForm() {
    const stationSel = document.getElementById("bookStationSelect");
    const pointSel = document.getElementById("bookPointSelect");
    const dateEl = document.getElementById("bookDate");
    const loadBtn = document.getElementById("loadSlotsBtn");

    stationSel.addEventListener("change", () => {
        _selectedSlotId = null;
        _selectedPointId = null;
        pointSel.innerHTML = '<option value="">-- Select Charging Point --</option>';
        pointSel.disabled = true;
        document.getElementById("slotsPanel").innerHTML =
            `<div class="empty-state"><div class="empty-icon">🕐</div><p>Select a station, point, and date to see available slots</p></div>`;
        if (stationSel.value) {
            loadBookingPoints(stationSel.value);
        } else {
            checkLoadSlotsReady();
        }
    });

    pointSel.addEventListener("change", checkLoadSlotsReady);
    dateEl.addEventListener("change", () => {
        // Redirect past-date attempts
        const d = new Date();
        const localToday = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
        if (dateEl.value < localToday) {
            dateEl.value = localToday;
            showToast("You cannot select a past date.", "warning");
        }
        // Reload points for new date
        if (stationSel.value) {
            loadBookingPoints(stationSel.value);
        }
        checkLoadSlotsReady();
    });

    loadBtn.addEventListener("click", async () => {
        const stId = stationSel.value;
        const ptId = parseInt(pointSel.value);
        const dt = dateEl.value;
        if (!stId || !ptId || !dt) return;

        _selectedSlotId = null;
        _selectedPointId = ptId;
        await renderSlots(stId, ptId, dt);
    });
}

async function renderSlots(stationId, pointId, date) {
    const panel = document.getElementById("slotsPanel");
    panel.innerHTML = `<div class="loading-spinner"><span class="spinner"></span> Loading slots…</div>`;

    try {
        const res = await apiFetch(`/slots/${stationId}?date=${date}`);
        const points = res.data || [];
        const ptData = points.find(p => p.point_id === pointId);

        if (!ptData) {
            panel.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>No slots found for this point.</p></div>`;
            return;
        }

        let html = `<p class="slot-point-header">🔌 Point #${ptData.point_id} — ${date}</p>
                <div class="slots-grid" id="slotsGrid">`;

        ptData.slots.forEach(sl => {
            let cls = "";
            let label = "Available";
            let canSel = true;
            if (!sl.available && sl.past) { cls = "unavailable"; label = "Past"; canSel = false; }
            else if (!sl.available) { cls = "booked"; label = "Booked"; canSel = false; }
            const startShort = (sl.start_time || "").slice(0, 5);
            const endShort = (sl.end_time || "").slice(0, 5);
            html += `<div class="slot-chip ${cls}" data-slot-id="${sl.slot_id}" data-can-select="${canSel}">
                  <div class="slot-time">${startShort} – ${endShort}</div>
                  <div class="slot-status">${label}</div>
               </div>`;
        });

        html += `</div>
             <div id="bookBtnArea" style="margin-top:20px;display:none;">
               <button class="btn btn-primary btn-full" id="confirmBookBtn">⚡ Confirm Booking</button>
             </div>`;

        panel.innerHTML = html;

        // Slot selection
        panel.querySelectorAll(".slot-chip").forEach(chip => {
            if (chip.dataset.canSelect !== "true") return;
            chip.addEventListener("click", () => {
                panel.querySelectorAll(".slot-chip").forEach(c => c.classList.remove("selected"));
                chip.classList.add("selected");
                _selectedSlotId = parseInt(chip.dataset.slotId);
                document.getElementById("bookBtnArea").style.display = "block";
            });
        });

        // Confirm booking
        document.getElementById("confirmBookBtn")?.addEventListener("click", confirmBooking);
    } catch (err) {
        panel.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
    }
}

async function confirmBooking() {
    const stId = document.getElementById("bookStationSelect").value;
    const date = document.getElementById("bookDate").value;

    if (!_selectedSlotId || !_selectedPointId) {
        showToast("Please select a time slot.", "warning"); return;
    }

    const btn = document.getElementById("confirmBookBtn");
    btn.disabled = true;
    btn.textContent = "Booking…";

    try {
        const res = await apiFetch("/book-slot", {
            method: "POST",
            body: JSON.stringify({
                point_id: _selectedPointId,
                slot_id: _selectedSlotId,
                booking_date: date,
            }),
        });
        showToast(`🎉 ${res.message}`, "success");
        _selectedSlotId = null;
        _selectedPointId = null;
        _bookingFormLoaded = false;
        window.navigateTo("my-bookings");
    } catch (err) {
        showToast(err.message, "error");
        btn.disabled = false;
        btn.textContent = "⚡ Confirm Booking";
    }
}
