window.KS = window.KS || {};

KS.triggerSOS = function () {
  const fetchSOS = async (lat = null, lon = null) => {
    const data = await KS.api("/api/sos", {
      method: "POST",
      body: JSON.stringify({ worker_name: KS.user ? KS.user.name : "User", lat, lon }),
    });
    document.getElementById("sos-hospital-name").textContent = `${data.nearest_hospital.name} (${data.nearest_hospital.distance_km} km)`;
    document.getElementById("sos-hospital-nav").href = data.nearest_hospital.maps_url;
    document.getElementById("sos-wa-link").href = data.family_whatsapp_url;
    document.getElementById("sos-modal").classList.remove("hidden");
    KS.speak(data.hindi_audio);
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => fetchSOS(p.coords.latitude, p.coords.longitude), () => fetchSOS());
  } else {
    fetchSOS();
  }
};

KS.closeSOS = function () {
  document.getElementById("sos-modal").classList.add("hidden");
};
