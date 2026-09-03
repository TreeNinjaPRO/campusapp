/**
 * comms.js — /comms/index.html
 *
 * Renders the "Microsoft or etc." category selector plus the full service
 * list as square-block cards, each animating in on render. Cards are data
 * driven so new services/comms entries can be appended later at runtime
 * with HANCampus.addCommsCard().
 */
(function () {
  "use strict";

  var CATEGORIES = ["Alles", "Microsoft", "HAN", "Netwerk"];

  var SERVICES = [
    {
      title: "Brightspace",
      desc: "Cursusmateriaal, opdrachten en cijfers.",
      url: "https://leren.han.nl/",
      category: "HAN"
    },
    {
      title: "Osiris",
      desc: "Inschrijvingen, roosters en studievoortgang.",
      url: "https://han.osiris-student.nl/",
      category: "HAN"
    },
    {
      title: "Teams",
      desc: "Chat, video-bellen en samenwerken.",
      url: "https://teams.microsoft.com/v2/",
      category: "Microsoft"
    },
    {
      title: "Outlook",
      desc: "HAN-mail en agenda.",
      url: "http://outlook.office.com/",
      category: "Microsoft"
    },
    {
      title: "OneDrive",
      desc: "Bestanden opslaan en delen.",
      url: "https://hannl-my.sharepoint.com/",
      category: "Microsoft"
    },
    {
      title: "Isas",
      desc: "Cursusinformatie en afwezigheid.",
      url: "https://isas.han.nl/default.aspx",
      category: "HAN"
    },
    {
      title: "Ans",
      desc: "Toetsen en beoordelingen inzien.",
      url: "https://ans.han.nl/",
      category: "HAN"
    },
    {
      title: "Myx",
      desc: "Persoonlijk rooster en planning.",
      url: "https://han.myx.nl/",
      category: "HAN"
    },
    {
      title: "Eduroam",
      desc: "Wifi-toegang op HAN en andere instellingen.",
      url: "https://www.geteduroam.app/",
      category: "Netwerk"
    }
  ];

  var state = { filter: "Alles" };

  function renderSelector(container) {
    CATEGORIES.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "selectorbutton btn";
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener("click", function () {
        state.filter = cat;
        renderList();
      });
      container.appendChild(btn);
    });
  }

  function renderCard(container, service) {
    var card = document.createElement("a");
    card.className = "square-block comms-card";
    card.href = service.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.innerHTML =
      '<img class="comms-card__logo" src="/assets/logo.svg" alt="" />' +
      '<div class="comms-card__body">' +
      '<p class="comms-card__title">' + service.title + "</p>" +
      '<p class="comms-card__desc">' + service.desc + "</p>" +
      "</div>" +
      window.HANCampus.icon("open", "comms-card__download");
    container.appendChild(card);
  }

  function renderList() {
    var list = document.getElementById("comms-list");
    if (!list) return;
    list.innerHTML = "";

    SERVICES.filter(function (s) {
      return state.filter === "Alles" || s.category === state.filter;
    }).forEach(function (s) {
      renderCard(list, s);
    });

    var selectors = document.querySelectorAll(".selectorbutton");
    selectors.forEach(function (btn) {
      btn.classList.toggle("btn--dark", btn.dataset.category === state.filter);
      btn.style.background =
        btn.dataset.category === state.filter ? "var(--color-dark)" : "var(--color-primary)";
    });
  }

  /** Public hook: append a new comms card at runtime. */
  window.HANCampus = window.HANCampus || {};
  window.HANCampus.addCommsCard = function (title, desc, url, category) {
    SERVICES.push({ title: title, desc: desc, url: url, category: category || "Alles" });
    renderList();
  };

  document.addEventListener("DOMContentLoaded", function () {
    var selector = document.getElementById("selector");
    if (selector) renderSelector(selector);
    renderList();
  });
})();
