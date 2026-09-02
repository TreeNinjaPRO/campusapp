/**
 * assistant.js — /assistant/index.html ("HANssistent AI")
 *
 * Loads the WebLLM in-browser engine (@mlc-ai/web-llm, via CDN — nothing
 * is sent to a server, inference runs locally in WebGPU) and exposes it
 * as two named assistants with distinct system prompts, as requested:
 *
 *   - assistantLLM  — general campus-app helper
 *   - calenderLLM   — reads the schedule screenshot captured on
 *                     /schedule/index.html and helps turn it into
 *                     calendar-ready text
 *
 * Note on the .gguf pill: WebLLM (unlike llama.cpp/wllama) runs its own
 * MLC-format prebuilt weights rather than parsing arbitrary raw .gguf
 * bytes client-side. The import pill keeps the requested "drop a .gguf
 * file" affordance and UI copy, and best-effort maps the chosen filename
 * to a matching WebLLM prebuilt model; if nothing matches it falls back
 * to a small default. Swap this mapping for a wllama-based loader if you
 * need literal arbitrary-GGUF parsing instead of WebLLM's own catalogue.
 */
(function () {
  "use strict";

  var CAPTURE_KEY = "han_schedule_capture";

  var SYSTEM_PROMPTS = {
    assistantLLM:
      "Je bent HANssistent, de behulpzame AI-assistent van de HAN Campusapp. " +
      "Je helpt studenten hun rooster, communicatie-apps en opleiding te " +
      "navigeren. Antwoord kort, vriendelijk en in het Nederlands, tenzij de " +
      "student in een andere taal typt.",
    calenderLLM:
      "Je bent calenderLLM, gespecialiseerd in het lezen van een schermafbeelding " +
      "van een rooster en die omzetten naar een duidelijke lijst agenda-items " +
      "(datum, tijd, vak, locatie). Als er geen afbeelding is meegegeven, vraag " +
      "de student om eerst 'Add to Calender' te gebruiken op de roosterpagina."
  };

  // Best-effort filename → WebLLM prebuilt model id.
  var MODEL_MAP = [
    { test: /vision|phi.*3\.5/i, id: "Phi-3.5-vision-instruct-q4f16_1-MLC-1k" },
    { test: /llama.*3\.2.*3b/i, id: "Llama-3.2-3B-Instruct-q4f16_1-MLC" },
    { test: /llama.*3\.2.*1b/i, id: "Llama-3.2-1B-Instruct-q4f16_1-MLC" },
    { test: /qwen/i, id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" }
  ];
  var DEFAULT_TEXT_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
  var VISION_MODEL = "Phi-3.5-vision-instruct-q4f16_1-MLC-1k";

  var state = {
    engine: null,
    engineModelId: null,
    mode: "assistantLLM",
    screenshot: null
  };

  var els = {};

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
    // If we have mmproj/vision support, prefer vision-capable models
    if (hasVisionSupport || state.screenshot) {
      return VISION_MODEL;
    }
    
    for (var i = 0; i < MODEL_MAP.length; i++) {
      if (MODEL_MAP[i].test.test(filename)) return MODEL_MAP[i].id;
    }
    return DEFAULT_TEXT_MODEL;
  }

  async function loadEngine(modelId) {
    setStatus("WebLLM module laden vanaf CDN…");
    var webllm;
    try {
      webllm = await import("https://esm.run/@mlc-ai/web-llm");
    } catch (err) {
      setStatus(
        "Kon WebLLM niet laden (geen internetverbinding of geen WebGPU-ondersteuning)."
      );
      return;
    }

    if (!navigator.gpu) {
      setStatus("Deze browser ondersteunt geen WebGPU — HANssistent kan niet lokaal draaien.");
      return;
    }

    try {
      state.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: function (progress) {
          setStatus(
            "<strong>" + modelId + "</strong> laden — " +
              Math.round((progress.progress || 0) * 100) + "%"
          );
        }
      });
      state.engineModelId = modelId;
      setStatus("<strong>" + modelId + "</strong> geladen. Klaar om te chatten.");
      log("system", "Model geladen: " + modelId);
    } catch (err) {
      setStatus("Model laden mislukt: " + (err && err.message ? err.message : err));
    }
  }

  function buildMessages(userText) {
    var messages = [{ role: "system", content: SYSTEM_PROMPTS[state.mode] }];

    if (state.mode === "calenderLLM" && state.screenshot) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Hier is de schermafbeelding van mijn rooster." },
          { type: "image_url", image_url: { url: state.screenshot } }
        ]
      });
    }

    messages.push({ role: "user", content: userText });
    return messages;
  }

  async function sendMessage(userText) {
    if (!state.engine) {
      window.HANCampus.toast("Importeer eerst een model via de .gguf-knop linksonder.");
      return;
    }

    log("user", userText);
    var botBubble = log("bot", "…");

    try {
      var messages = buildMessages(userText);
      var stream = await state.engine.chat.completions.create({
        messages: messages,
        stream: true
      });

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
    } catch (err) {
      botBubble.textContent = "Fout tijdens genereren: " + (err && err.message ? err.message : err);
    }
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

  document.addEventListener("DOMContentLoaded", function () {
    els.status = $("assistant-status");
    els.log = $("assistant-log");
    els.form = $("assistant-form");
    els.input = $("assistant-input");
    els.modeButtons = Array.prototype.slice.call(document.querySelectorAll(".assistant-mode"));
    els.fileInput = $("gguf-file-input");
    els.screenshotPanel = $("assistant-screenshot");
    els.screenshotThumb = $("assistant-screenshot-thumb");
    els.analyzeBtn = $("analyze-schedule-btn");

    // Create the importer pill if it doesn't exist
    if (!document.getElementById("model-import-btn")) {
      window.WebLLM.ModelImporter.createImporterUI();
    }

    setStatus("Nog geen model geladen. Importeer een .gguf-bestand om te starten.");
    refreshScreenshotPanel();
    
    els.fileInput.addEventListener("click", function() {
      // Double check if pill exists before allowing click if it was something else
      // but here we just trigger the existing logic
    });
    
    // Re-attach listener to the pill managed by the UI manager
    var pill = document.querySelector(".model-importer-pill");
    if (pill) {
      var btn = pill.querySelector("#model-import-btn");
      if (btn) {
        btn.addEventListener("click", function() {
          els.fileInput.click();
        });
      }
    }

    els.fileInput.addEventListener("change", function () {
      var files = els.fileInput.files;
      if (!files || !files.length) return;
      
      var mainModel = null;
      var mmproj = null;
      var fileNames = [];

      // Separate main model from mmproj files
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        fileNames.push(file.name);

        if (file.name.includes("mmproj-") || file.name.includes("mmproj")) {
          mmproj = file.name;
        } else {
          mainModel = file.name;
        }
      }

      // Log what was imported
      var logMsg = "📁 Modellen geïmporteerd:";
      if (mainModel) logMsg += "\n- Hoofdmodel: " + mainModel;
      if (mmproj) logMsg += "\n- Multimodaal: " + mmproj;
      
      log("system", logMsg);

      // Load the main model (prefer vision model if mmproj is available)
      var modelToLoad = mainModel || mmproj;
      if (modelToLoad) {
        loadEngine(pickModelId(modelToLoad, !!mmproj));
      }
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
      els.analyzeBtn.addEventListener("click", function () {
        setMode("calenderLLM");
        sendMessage("Zet dit rooster om in een lijst agenda-items.");
      });
    }
  });
})();
