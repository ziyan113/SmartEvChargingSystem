/**
 * calculator.js – Energy requirement calculator
 */

document.getElementById("calcBtn")?.addEventListener("click", calculateEnergy);

function calculateEnergy() {
    const distance = parseFloat(document.getElementById("calcDistance").value);
    const efficiency = parseFloat(document.getElementById("calcEfficiency").value);
    const power = parseFloat(document.getElementById("calcChargerPower").value) || 22;

    if (!distance || !efficiency || distance <= 0 || efficiency <= 0) {
        showToast("Please enter valid distance and efficiency values.", "warning");
        return;
    }

    const energyKwh = distance / efficiency;                   // kWh
    const durationHrs = energyKwh / power;                       // hours
    const durationMins = Math.round(durationHrs * 60);
    const durationStr = durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
        : `${durationMins} min`;

    document.getElementById("resultEnergy").textContent = energyKwh.toFixed(2);
    document.getElementById("resultDuration").textContent = durationStr;
    document.getElementById("resultRange").textContent = `${distance} km`;

    const tip = energyKwh < 20
        ? "💡 Tip: A 22kW AC charger can handle this in a single session."
        : energyKwh < 50
            ? "⚡ Tip: Use a DC fast charger (50kW+) for quicker charging."
            : "🔋 Tip: Long trip! Consider a 150kW+ rapid charger or split into two sessions.";
    document.getElementById("calcTip").textContent = tip;
    document.getElementById("calcResult").style.display = "block";
}
