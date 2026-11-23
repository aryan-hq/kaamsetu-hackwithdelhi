window.KS = window.KS || {};
KS.workerMap = null;
KS.workerMarkers = null;
KS.employerMap = null;
KS.employerPin = null;

KS.initWorkerMap = function () {
  if (KS.workerMap) {
    setTimeout(() => KS.workerMap.invalidateSize(), 150);
    return;
  }
  KS.workerMap = L.map("worker-map", { zoomControl: false }).setView([28.6304, 77.2772], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(KS.workerMap);
  KS.workerMarkers = L.layerGroup().addTo(KS.workerMap);
};

KS.updateWorkerMapPins = function (jobs) {
  KS.initWorkerMap();
  KS.workerMarkers.clearLayers();
  const bounds = [];
  jobs.forEach((j) => {
    if (!j.lat || !j.lon) return;
    const m = L.marker([j.lat, j.lon]).addTo(KS.workerMarkers);
    m.bindPopup(`
      <div style="min-width:160px;font-family:inherit;">
        <div style="font-weight:700;font-size:13px;">${j.employer_name}</div>
        <div style="font-size:11px;color:#475569;margin:2px 0;">${j.skill} · Payout ₹${j.worker_payout}</div>
        <a href="${j.maps_url}" target="_blank" rel="noopener"
           style="display:inline-block;margin-top:6px;background:#2563EB;color:#fff;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">
           Live Turn-by-Turn Nav
        </a>
      </div>
    `);
    bounds.push([j.lat, j.lon]);
  });
  if (bounds.length) KS.workerMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
};

KS.initEmployerMap = function () {
  if (KS.employerMap) {
    setTimeout(() => KS.employerMap.invalidateSize(), 150);
    return;
  }
  const lat = parseFloat(document.getElementById("emp-lat").value);
  const lon = parseFloat(document.getElementById("emp-lon").value);
  KS.employerMap = L.map("employer-map", { zoomControl: false }).setView([lat, lon], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(KS.employerMap);
  KS.employerPin = L.marker([lat, lon], { draggable: true }).addTo(KS.employerMap);
  KS.employerPin.on("dragend", () => {
    const p = KS.employerPin.getLatLng();
    KS.setEmployerPin(p.lat, p.lng);
  });
  KS.employerMap.on("click", (e) => KS.setEmployerPin(e.latlng.lat, e.latlng.lng));
};

KS.setEmployerPin = function (lat, lon) {
  document.getElementById("emp-lat").value = lat.toFixed(5);
  document.getElementById("emp-lon").value = lon.toFixed(5);
  if (KS.employerPin) KS.employerPin.setLatLng([lat, lon]);
  if (KS.employerMap) KS.employerMap.panTo([lat, lon]);
  document.getElementById("pin-coords-label").textContent = `Exact Pin: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
};

KS.moveEmployerPinToArea = function () {
  const coords = KS.AREA_COORDS[document.getElementById("emp-area").value];
  if (coords) KS.setEmployerPin(coords[0], coords[1]);
};

KS.useMyGPS = function () {
  if (!navigator.geolocation) return alert("GPS not supported.");
  navigator.geolocation.getCurrentPosition(
    (pos) => KS.setEmployerPin(pos.coords.latitude, pos.coords.longitude),
    () => alert("Could not fetch GPS. Tap on the map to place your pin.")
  );
};
