/**
 * misc.js — /schedule/misc.html ("Overige")
 *
 * Renders the collapsible list from a plain data array so new items —
 * e.g. a future "Cafeteria" replacement — can be added at runtime with
 * HANCampus.addCollapsible() instead of editing markup by hand.
 */
(function () {
  "use strict";

  var DEFAULT_ITEMS = [
    { title: "Cafeteria", body: "Openingstijden en huidige drukte van de cafeteria." },
    { title: "Overlegpunten", body: "Vrije overlegruimtes die je nu kan reserveren." },
    { title: "Snellaadpunten", body: "Locaties van snellaadpunten voor laptops en telefoons." },
    { title: "Fietsenstalling met laadpunt", body: "Stallingen met een oplaadpunt voor de e-bike." }
  ];

  function renderItem(container, item) {
    var el = document.createElement("div");
    el.className = "dropdown";
    el.innerHTML =
      '<button class="dropdown__head" type="button">' +
      "<span>" + item.title + "</span>" +
      '<span class="dropdown__chevron">⌄</span>' +
      "</button>" +
      '<div class="dropdown__body"><p>' + item.body + "</p></div>";

    el.querySelector(".dropdown__head").addEventListener("click", function () {
      el.classList.toggle("is-open");
    });

    container.appendChild(el);
  }

  /** Public hook so future pages/JS can add a collapsible without a rebuild. */
  window.HANCampus = window.HANCampus || {};
  window.HANCampus.addCollapsible = function (title, body) {
    var container = document.getElementById("dropdowns");
    if (!container) return;
    renderItem(container, { title: title, body: body || "" });
  };

  document.addEventListener("DOMContentLoaded", function () {
    var container = document.getElementById("dropdowns");
    if (!container) return;

    DEFAULT_ITEMS.forEach(function (item) {
      renderItem(container, item);
    });

    var form = document.getElementById("add-dropdown-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("add-dropdown-input");
        var title = (input.value || "").trim();
        if (!title) return;
        window.HANCampus.addCollapsible(title, "Nieuw toegevoegd item.");
        input.value = "";
      });
    }
  });
})();
