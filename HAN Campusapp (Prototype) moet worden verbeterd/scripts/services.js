/**
 * services.js — /schedule/services.html
 *
 * Clicking the square button in the "innermap" reveals a text box.
 * Typing a known place name (e.g. "Arnhem") and confirming automatically
 * navigates the embedded map iframe to that location — no page reload,
 * the iframe just gets a new src.
 */
(function () {
  "use strict";

  // Known campus locations → an OpenStreetMap embed centered on them.
  var LOCATIONS = {
    arnhem:
      "https://www.openstreetmap.org/export/embed.html?bbox=5.9330%2C51.9800%2C5.9600%2C51.9950&layer=mapnik&marker=51.9880%2C5.9470",
    nijmegen:
      "https://www.openstreetmap.org/export/embed.html?bbox=5.8450%2C51.8150%2C5.8750%2C51.8350&layer=mapnik&marker=51.8250%2C5.8600",
    tiel:
      "https://www.openstreetmap.org/export/embed.html?bbox=5.4200%2C51.8800%2C5.4600%2C51.9050&layer=mapnik&marker=51.8930%2C5.4300"
  };

  function normalise(value) {
    return (value || "").trim().toLowerCase();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggleBtn = document.getElementById("locate-toggle");
    var box = document.getElementById("locate-box");
    var input = document.getElementById("locate-input");
    var goBtn = document.getElementById("locate-go");
    var mapFrame = document.getElementById("map-frame");

    if (!toggleBtn || !box || !input || !mapFrame) return;

    toggleBtn.addEventListener("click", function () {
      box.classList.toggle("is-open");
      if (box.classList.contains("is-open")) input.focus();
    });

    function goToLocation() {
      var key = normalise(input.value);
      var url = LOCATIONS[key];
      if (!url) {
        window.HANCampus.toast('Onbekende locatie: "' + input.value + '"');
        return;
      }
      mapFrame.src = url;
      window.HANCampus.toast("Kaart bijgewerkt naar " + input.value + ".");
    }

    goBtn.addEventListener("click", goToLocation);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") goToLocation();
    });
  });
})();
