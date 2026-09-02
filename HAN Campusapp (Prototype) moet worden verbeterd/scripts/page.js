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

    // Dark Mode Toggle
    var darkModeToggle = document.getElementById("dark-mode-toggle");
    if (darkModeToggle) {
      var isDarkMode = localStorage.getItem("dark_mode") === "true";
      
      // Initial state
      if (isDarkMode) {
        document.body.classList.add("dark-theme");
        darkModeToggle.textContent = "On";
      }

      darkModeToggle.addEventListener("click", function () {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
          document.body.classList.add("dark-theme");
          darkModeToggle.textContent = "On";
          localStorage.setItem("dark_mode", "true");
        } else {
          document.body.classList.remove("dark-theme");
          darkModeToggle.textContent = "Off";
          localStorage.setItem("dark_mode", "false");
        }
      });
    }
  });
})();

