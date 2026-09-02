/**
 * nav.js — shared chrome for every HAN Campusapp page.
 *
 * Injects:
 *  - .topbar with the corner logo (assets/logo.svg), 50px from top + right
 *  - .borderpilldiv > .borderpill > .innerpill1..4 bottom nav
 *
 * Per the brief the pill nav is not gated behind a 767px breakpoint —
 * it is always present. Active state is derived from location.pathname.
 */
(function () {
  "use strict";

  var NAV_ITEMS = [
    { key: "schedule", label: "Rooster", href: "/schedule/index.html", match: /^\/schedule\//, icon: "/assets/schedule.svg" },
    { key: "comms", label: "Comms", href: "/comms/index.html", match: /^\/comms\//, icon: "/assets/comms.svg" },
    { key: "education", label: "Opleiding", href: "/education/index.html", match: /^\/education\//, icon: "/assets/education.svg" },
    { key: "page", label: "Mijn pagina", href: "/page/index.html", match: /^\/page\//, icon: "/assets/profile.svg" }
  ];

  function currentPath() {
    return window.location.pathname || "/";
  }

  function buildTopbar() {
    if (document.querySelector(".topbar")) return;
    var bar = document.createElement("div");
    bar.className = "topbar";
    bar.innerHTML = '<a href="/schedule/index.html" aria-label="HAN Campusapp home">' +
      '<img class="topbar__logo" src="/assets/logo.svg" alt="HAN Campusapp" /></a>';
    document.body.appendChild(bar);
  }

  function buildPillNav() {
    if (document.querySelector(".borderpilldiv")) return;

    var wrap = document.createElement("div");
    wrap.className = "borderpilldiv";

    var pill = document.createElement("nav");
    pill.className = "borderpill";
    pill.setAttribute("aria-label", "Hoofdnavigatie");

    var path = currentPath();

    NAV_ITEMS.forEach(function (item, i) {
      var a = document.createElement("a");
      a.className = "innerpill innerpill" + (i + 1);
      a.href = item.href;
      a.dataset.key = item.key;

      var isActive = item.match.test(path);
      if (isActive) a.classList.add("is-active");
      a.setAttribute("aria-current", isActive ? "page" : "false");

      a.innerHTML =
        '<img class="innerpilllogo innerpilllogo' + (i + 1) + '" src="' + item.icon + '" alt="" />' +
        '<span class="innerpill__label">' + item.label + "</span>";

      pill.appendChild(a);
    });

    wrap.appendChild(pill);
    document.body.appendChild(wrap);
  }

  /** Initialize WebLLM model importer pill */
  function buildModelImporterPill() {
    if (document.querySelector(".model-importer-pill")) return;

    var pill = document.createElement("div");
    pill.className = "model-importer-pill";
    pill.innerHTML =
      '<button id="model-import-btn" class="model-import-btn" title="Importeer AI model (.gguf)">📁 Import AI</button>';

    var button = pill.querySelector("#model-import-btn");
    button.addEventListener("click", function () {
      triggerModelFileDialog();
    });

    document.body.appendChild(pill);
  }

  /** Trigger file input dialog for .gguf model import */
  function triggerModelFileDialog() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".gguf";
    input.multiple = true;

    input.addEventListener("change", function (e) {
      if (e.target.files.length > 0) {
        if (window.WebLLM && window.WebLLM.calenderLLM) {
          window.WebLLM.calenderLLM
            .importMultipleModels(e.target.files)
            .then(function (result) {
              window.HANCampus.toast(result.message);
            })
            .catch(function (error) {
              window.HANCampus.toast("Import mislukt: " + error.message);
            });
        }
      }
    });

    input.click();
  }

  /** Initialize "Ask HANssistent" global button (50px above bottom bar) */
  function buildAssistantButton() {
    if (document.querySelector(".ask-hanssistent-btn")) return;

    var btn = document.createElement("button");
    btn.className = "ask-hanssistent-btn";
    btn.textContent = "❓ Ask HANssistent";
    btn.setAttribute("title", "Open HANssistent AI assistant");

    btn.addEventListener("click", function () {
      window.location.href = "/assistant/index.html";
    });

    document.body.appendChild(btn);
  }

  /** Small reusable toast, used by several pages for lightweight feedback. */
  window.HANCampus = window.HANCampus || {};
  window.HANCampus.toast = function (message, duration) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();

    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);

    requestAnimationFrame(function () {
      el.classList.add("is-visible");
    });

    setTimeout(function () {
      el.classList.remove("is-visible");
      setTimeout(function () {
        el.remove();
      }, 200);
    }, duration || 2200);
  };

  document.addEventListener("DOMContentLoaded", function () {
    buildTopbar();
    buildPillNav();

    // Add page-specific class to body
    var path = currentPath();
    if (path.includes("/assistant/")) {
      document.body.classList.add("page-assistant");
      buildModelImporterPill();
    } else if (path.includes("/comms/")) {
      document.body.classList.add("page-comms");
    } else if (path.includes("/education/")) {
      document.body.classList.add("page-education");
    } else if (path.includes("/page/")) {
      document.body.classList.add("page-profile");
    } else if (path.includes("/schedule/")) {
      document.body.classList.add("page-schedule");
    }

    buildAssistantButton();
  });
})();
