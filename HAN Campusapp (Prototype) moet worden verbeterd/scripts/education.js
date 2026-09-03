(function () {
  "use strict";

  var EC_KEY = "ec_progress"; // stored as "earned-total", e.g. "45-60"

  function applyProgress(circle, valueEl, earned, total) {
    var pct = total > 0 ? Math.min(100, Math.max(0, (earned / total) * 100)) : 0;
    circle.style.setProperty("--ec-pct", String(pct));
    valueEl.textContent = earned + "/" + total;
    circle.title = "EC voortgang: " + earned + " van de " + total + " behaald. Klik om aan te passen.";
  }

  function loadProgress(circle, valueEl) {
    var stored = localStorage.getItem(EC_KEY);
    if (!stored) return;
    var parts = stored.split("-");
    var earned = parseInt(parts[0], 10);
    var total = parseInt(parts[1], 10);
    if (!isNaN(earned) && !isNaN(total) && total > 0) {
      applyProgress(circle, valueEl, earned, total);
    }
  }

  function initEcCircle() {
    var circle = document.getElementById("ec-circle");
    var valueEl = document.getElementById("ec-circle-value");
    if (!circle || !valueEl) return;

    loadProgress(circle, valueEl);

    circle.addEventListener("click", function () {
      startEditing();
    });
    circle.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startEditing();
      }
    });

    function startEditing() {
      if (circle.querySelector(".ec-circle__input")) return;
      var input = document.createElement("input");
      input.type = "text";
      input.className = "ec-circle__input";
      input.placeholder = "##-##";
      input.maxLength = 5;
      input.inputMode = "numeric";
      input.value = valueEl.textContent.indexOf("--") === -1 ? valueEl.textContent.replace("/", "-") : "";

      circle.replaceChild(input, valueEl);
      input.focus();
      input.select();

      var committed = false;
      function commit() {
        if (committed) return;
        committed = true;
        var match = /^(\d{1,2})-(\d{1,2})$/.exec((input.value || "").trim());
        if (match) {
          var earned = parseInt(match[1], 10);
          var total = parseInt(match[2], 10);
          if (total > 0) {
            localStorage.setItem(EC_KEY, earned + "-" + total);
            applyProgress(circle, valueEl, earned, total);
          }
        }
        if (input.parentNode === circle) {
          circle.replaceChild(valueEl, input);
        }
      }

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (input.parentNode === circle) circle.replaceChild(valueEl, input);
        }
      });
      input.addEventListener("blur", commit);
      input.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = document.getElementById("ask-opleiding-btn");
    var overlay = document.getElementById("opleiding-overlay");
    var closeBtn = document.getElementById("opleiding-close");

    if (openBtn && overlay) {
      openBtn.addEventListener("click", function () {
        overlay.classList.add("is-open");
      });
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener("click", function () {
        overlay.classList.remove("is-open");
      });
    }

    initEcCircle();
  });
})();
