/**
 * nav.js — shared chrome for every HAN Campusapp page.
 *
 * Injects:
 *  - .topbar with the corner logo, 50px from top + right
 *  - .borderpilldiv > .borderpill > .innerpill1..4 bottom nav
 *  - a shared dark-mode application routine (so the manual toggle set on
 *    /page/index.html actually applies everywhere, not just there)
 *  - a single, canonical "Import AI" pill wired to scripts/webllm.js
 *
 * Per the brief the pill nav is not gated behind a 767px breakpoint —
 * it is always present. Active state is derived from location.pathname.
 *
 * Icons are inlined as <svg> (not <img src="...svg">) on purpose: an
 * <img>-loaded SVG is a separate document, so its internal
 * stroke="currentColor"/fill="currentColor" never actually inherits the
 * page's color — it always renders in the color baked into the file
 * (effectively black). That made every nav/location icon invisible
 * against dark backgrounds (dark mode, and the already-dark "innermap"
 * bar even in light mode). Inline SVG fixes this for good: currentColor
 * now genuinely tracks the surrounding CSS color, including every
 * existing light/dark-mode rule.
 */
(function () {
  "use strict";

  // Inline icon set — every path below is intentionally stroke/fill="currentColor"
  // so recoloring (hover, active, dark mode) is handled entirely by CSS `color`.
  var ICONS = {
    schedule:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    comms:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    education:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    profile:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    assistant:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m0 4.24l-4.24 4.24M19.78 4.22l-4.24 4.24m0 4.24l4.24 4.24M1 12h6m6 0h6"></path></svg>',
    location:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="var(--color-light, #fff)"/></svg>',
    open:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"></path><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"></path></svg>'
  };

  window.HANCampus = window.HANCampus || {};
  /** Small helper other page scripts can use to inline any of the icons above. */
  window.HANCampus.icon = function (name, extraClass) {
    var svg = ICONS[name] || "";
    if (!svg) return "";
    if (extraClass) {
      svg = svg.replace("<svg ", '<svg class="' + extraClass + '" ');
    }
    return svg;
  };

  var NAV_ITEMS = [
    { key: "schedule", label: "Rooster", href: "/schedule/index.html", match: /^\/schedule\//, icon: "schedule" },
    { key: "comms", label: "Comms", href: "/comms/index.html", match: /^\/comms\//, icon: "comms" },
    { key: "education", label: "Opleiding", href: "/education/index.html", match: /^\/education\//, icon: "education" },
    { key: "page", label: "Mijn pagina", href: "/page/index.html", match: /^\/page\//, icon: "profile" }
  ];

  var DARK_MODE_KEY = "dark_mode";

  function currentPath() {
    return window.location.pathname || "/";
  }

  /* ------------------------------------------------------------------
   * Dark mode — applied on every page (previously only wired up on
   * /page/index.html, so navigating away silently lost the manual
   * choice). Also lets the manual toggle override the OS-level
   * prefers-color-scheme by adding .light-theme.
   * ------------------------------------------------------------------ */
  function applyDarkModePreference() {
    var stored = localStorage.getItem(DARK_MODE_KEY);
    document.documentElement.classList.remove("dark-theme", "light-theme");
    if (stored === "true") {
      document.documentElement.classList.add("dark-theme");
    } else if (stored === "false") {
      document.documentElement.classList.add("light-theme");
    }
    // stored === null → follow OS preference (prefers-color-scheme), untouched.
  }

  window.HANCampus.setDarkMode = function (enabled) {
    localStorage.setItem(DARK_MODE_KEY, enabled ? "true" : "false");
    applyDarkModePreference();
  };

  window.HANCampus.isDarkMode = function () {
    var stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };

  // Apply immediately (script runs after DOM parsing thanks to `defer`,
  // so document.documentElement already exists) to avoid a flash of the
  // wrong theme while the rest of the page chrome builds.
  applyDarkModePreference();

  function buildTopbar() {
    if (document.querySelector(".topbar")) return;
    var bar = document.createElement("div");
    bar.className = "topbar";
    bar.innerHTML =
      '<a href="/schedule/index.html" aria-label="HAN Campusapp home" class="topbar__logo-link">' +
      '<svg class="topbar__logo" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="0" y="4" width="32" height="32" rx="8" fill="#e70052"/>' +
      '<path d="M9 12v16M9 20h9M18 12v16" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="40" y="26" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="15" font-weight="700" class="topbar__logo-text">campus</text>' +
      "</svg></a>";
    document.body.appendChild(bar);
  }

  function buildPillNav() {
    if (document.querySelector(".borderpilldiv")) return;

    var wrap = document.createElement("div");
    wrap.className = "borderpilldiv";

    var pill = document.createElement("nav");
    pill.className = "borderpill";
    pill.setAttribute("aria-label", "Hoofdnavigatie");

    var indicator = document.createElement("span");
    indicator.className = "innerpill__indicator";
    pill.appendChild(indicator);

    var path = currentPath();
    var activeIndex = -1;

    NAV_ITEMS.forEach(function (item, i) {
      var a = document.createElement("a");
      a.className = "innerpill innerpill" + (i + 1);
      a.href = item.href;
      a.dataset.key = item.key;

      var isActive = item.match.test(path);
      if (isActive) {
        a.classList.add("is-active");
        activeIndex = i;
      }
      a.setAttribute("aria-current", isActive ? "page" : "false");

      a.innerHTML =
        window.HANCampus.icon(item.icon, "innerpilllogo innerpilllogo" + (i + 1)) +
        '<span class="innerpill__label">' + item.label + "</span>";

      pill.appendChild(a);
    });

    wrap.appendChild(pill);
    document.body.appendChild(wrap);

    if (activeIndex >= 0) {
      // Position the sliding highlight without animating in on first paint.
      requestAnimationFrame(function () {
        moveIndicator(pill, indicator, activeIndex, true);
      });
    }

    window.addEventListener("resize", function () {
      var current = pill.querySelector(".innerpill.is-active");
      if (current) {
        var idx = Array.prototype.indexOf.call(pill.querySelectorAll(".innerpill"), current);
        moveIndicator(pill, indicator, idx, true);
      }
    });
  }

  /** Slide the pill's active-state background under the given item index. */
  function moveIndicator(pill, indicator, index, instant) {
    var items = pill.querySelectorAll(".innerpill");
    var target = items[index];
    if (!target) {
      indicator.style.opacity = "0";
      return;
    }
    var width = target.offsetWidth;
    var x = target.offsetLeft;
    if (instant) indicator.style.transition = "none";
    indicator.style.opacity = "1";
    indicator.style.width = width + "px";
    indicator.style.transform = "translateX(" + x + "px)";
    if (instant) {
      // Force reflow, then restore the tweened transition for future moves.
      // eslint-disable-next-line no-unused-expressions
      indicator.offsetHeight;
      indicator.style.transition = "";
    }
  }

  /** Delegated "Import AI" pill — single canonical implementation lives in webllm.js. */
  function buildModelImporterPill() {
    if (window.WebLLM && window.WebLLM.ModelImporter) {
      window.WebLLM.ModelImporter.createImporterUI();
    }
  }

  /** Initialize "Ask HANssistent" global button (above the bottom bar). */
  function buildAssistantButton() {
    if (document.querySelector(".ask-hanssistent-btn")) return;

    var btn = document.createElement("button");
    btn.className = "ask-hanssistent-btn";
    btn.innerHTML = window.HANCampus.icon("assistant", "ask-hanssistent-btn__icon") + "<span>Ask HANssistent</span>";
    btn.setAttribute("title", "Open HANssistent AI assistant");
    btn.type = "button";

    btn.addEventListener("click", function () {
      navigateTo("/assistant/index.html");
    });

    document.body.appendChild(btn);
  }

  /**
   * Progressive-enhancement page transition: use the View Transitions API
   * when the browser supports it for a smooth cross-fade between pages,
   * otherwise just navigate normally. Fully static multi-page sites don't
   * usually get this kind of polish, so it's opt-in and never blocks
   * navigation if unsupported or if it throws.
   */
  function navigateTo(href) {
    if (document.startViewTransition) {
      document.startViewTransition(function () {
        window.location.href = href;
      });
    } else {
      window.location.href = href;
    }
  }

  function wireInternalLinkTransitions() {
    document.body.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest("a[href^='/']");
      if (!link || link.target === "_blank") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!document.startViewTransition) return; // let the browser handle it natively
      e.preventDefault();
      navigateTo(link.getAttribute("href"));
    });
  }

  /** Small reusable toast, used by several pages for lightweight feedback. */
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
      }, 220);
    }, duration || 2200);
  };

  document.addEventListener("DOMContentLoaded", function () {
    applyDarkModePreference();
    buildTopbar();
    buildPillNav();
    wireInternalLinkTransitions();

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
