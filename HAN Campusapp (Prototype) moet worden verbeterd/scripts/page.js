(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var tabs = document.querySelectorAll(".page-tab");
    var contents = document.querySelectorAll(".page-tab-content");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tabName = this.getAttribute("data-tab");

        // Remove active class from all tabs and hide contents
        tabs.forEach(function (t) {
          t.classList.remove("is-active");
        });
        contents.forEach(function (c) {
          c.style.display = "none";
        });

        // Add active class to clicked tab and show content
        tab.classList.add("is-active");
        var activeContent = document.querySelector('[data-tab-content="' + tabName + '"]');
        if (activeContent) activeContent.style.display = "block";
      });
    });

    var editBtn = document.getElementById("edit-profile-btn");
    var overlay = document.getElementById("edit-overlay");
    var cancelBtn = document.getElementById("edit-cancel");
    var form = document.getElementById("edit-form");
    var nameEl = document.getElementById("profile-name");
    var emailEl = document.getElementById("profile-email");

    if (editBtn && overlay) {
      editBtn.addEventListener("click", function () {
        document.getElementById("edit-name-input").value = nameEl.textContent;
        document.getElementById("edit-email-input").value = emailEl.textContent;
        overlay.classList.add("is-open");
      });
    }
    if (cancelBtn && overlay) {
      cancelBtn.addEventListener("click", function () {
        overlay.classList.remove("is-open");
      });
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        nameEl.textContent = document.getElementById("edit-name-input").value || nameEl.textContent;
        emailEl.textContent = document.getElementById("edit-email-input").value || emailEl.textContent;
        overlay.classList.remove("is-open");
        window.HANCampus.toast("Profiel bijgewerkt.");
      });
    }

    // Dark Mode Toggle — delegates to HANCampus.setDarkMode (scripts/nav.js)
    // so the preference is applied consistently on every page, not just
    // here, and persists across navigation.
    var darkModeToggle = document.getElementById("dark-mode-toggle");
    if (darkModeToggle) {
      var isDarkMode = window.HANCampus.isDarkMode();
      darkModeToggle.textContent = isDarkMode ? "On" : "Off";
      darkModeToggle.classList.toggle("is-active", isDarkMode);

      darkModeToggle.addEventListener("click", function () {
        isDarkMode = !isDarkMode;
        window.HANCampus.setDarkMode(isDarkMode);
        darkModeToggle.textContent = isDarkMode ? "On" : "Off";
        darkModeToggle.classList.toggle("is-active", isDarkMode);
      });
    }
  });
})();

