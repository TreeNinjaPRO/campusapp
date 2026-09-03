/**
 * assistant.js — /assistant/index.html ("HANssistent AI")
 *
 * HANssistent now works out of the box in every scenario:
 *  - As soon as the page loads it's usable via a local, dependency-free
 *    fallback responder (scripts/webllm.js: WebLLM.assistantLLM /
 *    WebLLM.calenderLLM) — no import, no waiting, no network required.
 *  - In the background, if the browser supports WebGPU, it silently tries
 *    to load a small real WebLLM model (@mlc-ai/web-llm, via CDN — nothing
 *    is sent to a server, inference runs locally) and upgrades in place
 *    once ready. If that fails for any reason (no WebGPU, offline, blocked
 *    CDN, non-secure context) the fallback just keeps answering — the chat
 *    never dead-ends.
 *  - Importing a custom .gguf model (via the pill nav.js builds on this
 *    page) is an optional power-user upgrade path, not a requirement.
 */
(function () {
  "use strict";

  var CAPTURE_KEY = "han_schedule_capture";

  // Best-effort filename → WebLLM prebuilt model id, used only when the
  // user explicitly imports a custom model file.
  var MODEL_MAP = [
    { test: /vision|phi.*3\.5/i, id: "Phi-3.5-vision-instruct-q4f16_1-MLC-1k" },
    { test: /llama.*3\.2.*3b/i, id: "Llama-3.2-3B-Instruct-q4f16_1-MLC" },
    { test: /llama.*3\.2.*1b/i, id: "Llama-3.2-1B-Instruct-q4f16_1-MLC" },
    { test: /qwen/i, id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" }
  ];
  var AUTO_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; // small + fast, good for a silent background auto-load
  var VISION_MODEL = "Phi-3.5-vision-instruct-q4f16_1-MLC-1k";

  var state = {
    engine: null,
    engineModelId: null,
    engineIsVision: false,
    mode: "assistantLLM",
    screenshot: null
  };

  var els = {};

  // Shared bridge other scripts (webllm.js's calenderLLM, schedule.js) can
  // check to see if a real local model is ready, without depending on
  // this page's internal state directly.
  window.HANCampus = window.HANCampus || {};
  window.HANCampus.aiEngine = { engine: null, modelId: null, vision: false, ready: false };

  function $(id) {
    return document.getElementById(id);
  }

  function log(role, text) {
    var bubble = document.createElement("div");
    bubble.className =
      "assistant-msg " +
      (role === "user" ? "assistant-msg--user" : role === "system" ? "assistant-msg--system" : "assistant-msg--bot");
    bubble.textContent = text;
    els.log.appendChild(bubble);
    els.log.scrollTop = els.log.scrollHeight;
    return bubble;
  }

  function setStatus(html) {
    els.status.innerHTML = html;
  }

  function pickModelId(filename, hasVisionSupport) {
    if (hasVisionSupport || state.screenshot) return VISION_MODEL;
    for (var i = 0; i < MODEL_MAP.length; i++) {
      if (MODEL_MAP[i].test.test(filename)) return MODEL_MAP[i].id;
    }
    return AUTO_MODEL;
  }

  /**
   * Load a real local WebLLM engine. Used both for the silent background
   * auto-load and for a user-imported model. Never throws to the caller —
   * failures just leave the fallback responder in charge.
   */
  async function loadEngine(modelId, opts) {
    opts = opts || {};
    var silent = !!opts.silent;

    if (!navigator.gpu) {
      if (!silent) setStatus("Deze browser ondersteunt geen WebGPU — HANssistent blijft in lokale (niet-model) modus.");
      return false;
    }

    var webllm;
    try {
      if (!silent) setStatus("WebLLM-module laden vanaf CDN…");
      webllm = await import("https://esm.run/@mlc-ai/web-llm");
    } catch (err) {
      if (!silent) setStatus("Kon WebLLM niet laden (geen internetverbinding of CDN geblokkeerd). HANssistent blijft bruikbaar in lokale modus.");
      return false;
    }

    try {
      var engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: function (progress) {
          setStatus(
            "<strong>" + modelId + "</strong> laden — " + Math.round((progress.progress || 0) * 100) + "%"
          );
        }
      });

      state.engine = engine;
      state.engineModelId = modelId;
      state.engineIsVision = modelId === VISION_MODEL;

      window.HANCampus.aiEngine.engine = engine;
      window.HANCampus.aiEngine.modelId = modelId;
      window.HANCampus.aiEngine.vision = state.engineIsVision;
      window.HANCampus.aiEngine.ready = true;

      setStatus("<strong>" + modelId + "</strong> geladen — HANssistent draait nu volledig lokaal.");
      log("system", "Lokaal AI-model geladen: " + modelId);
      return true;
    } catch (err) {
      if (!silent) setStatus("Model laden mislukt: " + (err && err.message ? err.message : err) + " — HANssistent blijft bruikbaar in lokale modus.");
      return false;
    }
  }

  function buildMessages(userText) {
    var messages = [{ role: "system", content: window.WebLLM.assistantLLM.systemPrompt }];
    if (state.mode === "calenderLLM") {
      messages = [{ role: "system", content: window.WebLLM.calenderLLM.systemPrompt }];
      if (state.screenshot) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "Hier is de schermafbeelding van mijn rooster." },
            { type: "image_url", image_url: { url: state.screenshot } }
          ]
        });
      }
    }
    messages.push({ role: "user", content: userText });
    return messages;
  }

  async function sendMessage(userText) {
    log("user", userText);
    var botBubble = log("bot", "…");

    // Real local model loaded and ready → stream a genuine response.
    if (state.engine) {
      try {
        var messages = buildMessages(userText);
        var stream = await state.engine.chat.completions.create({ messages: messages, stream: true });

        var full = "";
        for await (var chunk of stream) {
          var delta = chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
          if (delta) {
            full += delta;
            botBubble.textContent = full;
            els.log.scrollTop = els.log.scrollHeight;
          }
        }
        if (!full) botBubble.textContent = "(geen antwoord ontvangen)";
        return;
      } catch (err) {
        // Local model hiccuped — fall through to the guaranteed fallback below
        // instead of leaving the user with an error and nothing else.
        console.warn("Local engine failed mid-chat, using fallback:", err);
      }
    }

    // Guaranteed path — always answers, no model/network/WebGPU required.
    if (state.mode === "calenderLLM") {
      botBubble.textContent = "Ik heb geen lokaal AI-model geladen om je screenshot te analyseren, dus ik gebruik de ingebouwde roosterherkenning. Klik op 'Analyseer' hierboven, of gebruik 'Add to Calender' op de Roosterpagina.";
      return;
    }

    var result = await window.WebLLM.assistantLLM.query(userText);
    botBubble.textContent = result.response;
  }

  function setMode(mode) {
    state.mode = mode;
    els.modeButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
    });
    log("system", "Modus: " + mode);
  }

  function refreshScreenshotPanel() {
    var stored = sessionStorage.getItem(CAPTURE_KEY);
    if (!stored) {
      els.screenshotPanel.style.display = "none";
      return;
    }
    state.screenshot = stored;
    els.screenshotPanel.style.display = "flex";
    els.screenshotThumb.src = stored;
  }

  async function analyzeScreenshot() {
    setMode("calenderLLM");
    log("user", "Analyseer dit rooster.");
    var botBubble = log("bot", "Bezig met analyseren…");

    try {
      var result = await window.WebLLM.calenderLLM.processScheduleScreenshot(state.screenshot, null);
      var ics = window.WebLLM.calenderLLM.extractICS(result);
      if (ics) {
        window.WebLLM.calenderLLM.downloadICS(ics, "rooster.ics");
        botBubble.textContent = (result.message || "Rooster geanalyseerd.") + " Het .ics-bestand wordt gedownload.";
      } else {
        botBubble.textContent = "Kon geen agenda-items herkennen op de screenshot.";
      }
    } catch (err) {
      botBubble.textContent = "Analyseren mislukt: " + (err && err.message ? err.message : err);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.status = $("assistant-status");
    els.log = $("assistant-log");
    els.form = $("assistant-form");
    els.input = $("assistant-input");
    els.modeButtons = Array.prototype.slice.call(document.querySelectorAll(".assistant-mode"));
    els.screenshotPanel = $("assistant-screenshot");
    els.screenshotThumb = $("assistant-screenshot-thumb");
    els.analyzeBtn = $("analyze-schedule-btn");

    // Ready to chat immediately — no import required.
    setStatus("HANssistent is klaar om te helpen (lokale modus).");
    els.log.innerHTML = "";
    log("system", "Hoi! Ik ben HANssistent. Vraag me iets over je rooster, toetsen, comms-apps of opleiding.");
    refreshScreenshotPanel();

    // Silently try to upgrade to a real local WebLLM model in the
    // background. Never blocks the UI and never shows an error toast if
    // it doesn't work out — the fallback above already has the user covered.
    var autoModel = state.screenshot ? VISION_MODEL : AUTO_MODEL;
    loadEngine(autoModel, { silent: true });

    // React when a user imports a custom .gguf model via the nav pill.
    window.addEventListener("han:model-imported", function (e) {
      var detail = e.detail || {};
      var modelId = pickModelId(detail.mainModel || "", !!detail.mmproj);
      loadEngine(modelId, { silent: false });
    });

    els.modeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.dataset.mode);
      });
    });

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (els.input.value || "").trim();
      if (!text) return;
      els.input.value = "";
      sendMessage(text);
    });

    if (els.analyzeBtn) {
      els.analyzeBtn.addEventListener("click", analyzeScreenshot);
    }
  });
})();
