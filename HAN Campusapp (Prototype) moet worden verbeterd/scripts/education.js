(function () {
  "use strict";

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
  });
})();
