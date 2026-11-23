window.KS = window.KS || {};
KS.workerMap = null;
KS.workerMarkers = null;
KS.employerMap = null;
KS.employerPin = null;
KS.employerPinTouched = false;

KS.initWorkerMap = function () {
  if (!KS.workerMap) {
    KS.workerMap = L.map("worker-map", { zoomControl: false }).setView([28.6304, 77.2772], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(KS.workerMap);
    KS.workerMarkers = L.layerGroup().addTo(KS.workerMap);
  }
  setTimeout(() => {
    if (KS.workerMap) KS.workerMap.invalidateSize();
  }, 180);
};

KS.updateWorkerMapPins = function (jobs) {
  KS.initWorkerMap();
  KS.workerMarkers.clearLayers();
  const esc = KS.escapeHtml || ((s) => String(s ?? ""));
  const bounds = [];

  jobs.forEach((j) => {
    if (j.lat == null || j.lon == null) return;
    const m = L.marker([j.lat, j.lon]).addTo(KS.workerMarkers);
    m.bindPopup(`
      <div style="min-width:160px;font-family:inherit;">
        <div style="font-weight:700;font-size:13px;">${esc(j.employer_name)}</div>
        <div style="font-size:11px;color:#475569;margin:2px 0;">${esc(j.skill)} · ${esc(j.duration_label)} · ₹${esc(j.pay_amount)}</div>
        <a href="${esc(j.maps_url)}" target="_blank" rel="noopener"
           style="display:inline-block;margin-top:6px;background:#2563EB;color:#fff;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">
           Live Turn-by-Turn Nav
        </a>
      </div>
    `);
    bounds.push([j.lat, j.lon]);
  });

  // Recalculate size first, then fit bounds so markers center properly
  setTimeout(() => {
    if (!KS.workerMap) return;
    KS.workerMap.invalidateSize();
    if (bounds.length) {
      KS.workerMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
  }, 200);
};

KS.initEmployerMap = function () {
  const areaEl = document.getElementById("emp-area");
  const areaCoords = areaEl && KS.AREA_COORDS ? KS.AREA_COORDS[areaEl.value] : null;
  let lat = parseFloat(document.getElementById("emp-lat").value);
  let lon = parseFloat(document.getElementById("emp-lon").value);

  if (areaCoords && !KS.employerPinTouched) {
    lat = areaCoords[0];
    lon = areaCoords[1];
  }
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    lat = 28.6304;
    lon = 77.2772;
  }

  if (!KS.employerMap) {
    KS.employerMap = L.map("employer-map", { zoomControl: false }).setView([lat, lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(KS.employerMap);
    KS.employerPin = L.marker([lat, lon], { draggable: true }).addTo(KS.employerMap);
    KS.employerPin.on("dragend", () => {
      KS.employerPinTouched = true;
      const p = KS.employerPin.getLatLng();
      KS.setEmployerPin(p.lat, p.lng);
    });
    KS.employerMap.on("click", (e) => {
      KS.employerPinTouched = true;
      KS.setEmployerPin(e.latlng.lat, e.latlng.lng);
    });
  }

  KS.setEmployerPin(lat, lon);
  setTimeout(() => {
    if (KS.employerMap) {
      KS.employerMap.invalidateSize();
      KS.employerMap.setView([lat, lon], 14);
    }
  }, 200);
};

KS.setEmployerPin = function (lat, lon) {
  document.getElementById("emp-lat").value = lat.toFixed(5);
  document.getElementById("emp-lon").value = lon.toFixed(5);
  if (KS.employerPin) KS.employerPin.setLatLng([lat, lon]);
  if (KS.employerMap) KS.employerMap.panTo([lat, lon]);
  const label = document.getElementById("pin-coords-label");
  if (label) label.textContent = `Exact Pin: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
};

KS.moveEmployerPinToArea = function () {
  const areaEl = document.getElementById("emp-area");
  const coords = areaEl && KS.AREA_COORDS ? KS.AREA_COORDS[areaEl.value] : null;
  if (coords) {
    KS.employerPinTouched = false;
    KS.setEmployerPin(coords[0], coords[1]);
  }
};

KS.useMyGPS = function () {
  if (!navigator.geolocation) return alert("GPS not supported.");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      KS.employerPinTouched = true;
      KS.setEmployerPin(pos.coords.latitude, pos.coords.longitude);
    },
    () => alert("Could not fetch GPS. Tap on the map to place your pin.")
  );
};