/**
 * services.js — /schedule/services.html
 *
 * Clicking the square button in the "innermap" reveals a text box. Typing
 * any address or place — not just the 3 known campuses — resolves it via
 * OpenStreetMap's free Nominatim geocoder and re-centers the embedded map,
 * no page reload. Known HAN campuses resolve instantly with no network
 * round-trip; anything else is geocoded on demand. Addresses can also be
 * saved (☆) for one-click reuse later.
 */
(function () {
  "use strict";

  var SAVED_KEY = "han_saved_addresses";
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

  // Known campus locations resolve instantly, no network round-trip needed.
  var KNOWN_LOCATIONS = {
    arnhem: { label: "Arnhem", lat: 51.988, lon: 5.947 },
    nijmegen: { label: "Nijmegen", lat: 51.825, lon: 5.86 },
    tiel: { label: "Tiel", lat: 51.893, lon: 5.43 }
  };

  function normalise(value) {
    return (value || "").trim().toLowerCase();
  }

  function embedUrl(lat, lon, spanDeg) {
    spanDeg = spanDeg || 0.015;
    var minLon = (lon - spanDeg).toFixed(4);
    var maxLon = (lon + spanDeg).toFixed(4);
    var minLat = (lat - spanDeg / 2).toFixed(4);
    var maxLat = (lat + spanDeg / 2).toFixed(4);
    return (
      "https://www.openstreetmap.org/export/embed.html?bbox=" +
      minLon + "%2C" + minLat + "%2C" + maxLon + "%2C" + maxLat +
      "&layer=mapnik&marker=" + lat + "%2C" + lon
    );
  }

  async function geocode(query) {
    var url = NOMINATIM_URL + "?format=json&limit=1&addressdetails=0&q=" + encodeURIComponent(query);
    var response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Geocoding-service gaf een fout (" + response.status + ").");
    var results = await response.json();
    if (!results.length) throw new Error("Geen resultaten gevonden voor dit adres.");
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon), label: results[0].display_name };
  }

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveSaved(list) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggleBtn = document.getElementById("locate-toggle");
    var box = document.getElementById("locate-box");
    var input = document.getElementById("locate-input");
    var goBtn = document.getElementById("locate-go");
    var saveBtn = document.getElementById("locate-save");
    var mapFrame = document.getElementById("map-frame");
    var savedContainer = document.getElementById("saved-addresses");
    var iconSlot = document.getElementById("innermap-icon-slot");

    if (iconSlot && window.HANCampus && window.HANCampus.icon) {
      iconSlot.insertAdjacentHTML("afterbegin", window.HANCampus.icon("location", "innermap__icon"));
    }

    if (!toggleBtn || !box || !input || !mapFrame) return;

    var lastResolved = null; // { label, lat, lon } — last successfully shown place

    toggleBtn.addEventListener("click", function () {
      box.classList.toggle("is-open");
      if (box.classList.contains("is-open")) input.focus();
    });

    function showAt(lat, lon, label) {
      mapFrame.src = embedUrl(lat, lon);
      lastResolved = { label: label, lat: lat, lon: lon };
      window.HANCampus.toast("Kaart bijgewerkt naar " + label + ".");
    }

    async function goToLocation() {
      var raw = input.value;
      var key = normalise(raw);
      if (!raw) return;

      if (KNOWN_LOCATIONS[key]) {
        var known = KNOWN_LOCATIONS[key];
        showAt(known.lat, known.lon, known.label);
        return;
      }

      goBtn.disabled = true;
      goBtn.textContent = "…";
      try {
        var place = await geocode(raw);
        showAt(place.lat, place.lon, raw);
      } catch (err) {
        window.HANCampus.toast(err.message || "Kon dit adres niet vinden.");
      } finally {
        goBtn.disabled = false;
        goBtn.textContent = "Ga";
      }
    }

    function renderSaved() {
      var list = loadSaved();
      savedContainer.innerHTML = "";
      list.forEach(function (item, index) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "saved-address-chip";
        chip.innerHTML = "<span>" + item.label + "</span><span class=\"saved-address-chip__remove\" aria-label=\"Verwijderen\">×</span>";

        chip.querySelector("span:first-child").addEventListener("click", function () {
          showAt(item.lat, item.lon, item.label);
        });
        chip.querySelector(".saved-address-chip__remove").addEventListener("click", function (e) {
          e.stopPropagation();
          var updated = loadSaved();
          updated.splice(index, 1);
          saveSaved(updated);
          renderSaved();
        });

        savedContainer.appendChild(chip);
      });
    }

    goBtn.addEventListener("click", goToLocation);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") goToLocation();
    });

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (!lastResolved) {
          window.HANCampus.toast("Zoek eerst een adres op voordat je het opslaat.");
          return;
        }
        var list = loadSaved();
        if (list.some(function (l) { return l.label === lastResolved.label; })) {
          window.HANCampus.toast("Dit adres staat al bij je opgeslagen adressen.");
          return;
        }
        list.push(lastResolved);
        saveSaved(list);
        renderSaved();
        window.HANCampus.toast("Adres opgeslagen: " + lastResolved.label);
      });
    }

    renderSaved();
  });
})();
