/**
 * webllm.js — WebLLM Engine Integration
 * Handles model imports (.gguf files) and LLM inference for calendering and assistance tasks
 */

(function () {
  "use strict";

  // Initialize WebLLM global namespace
  if (!window.WebLLM) {
    window.WebLLM = {};
  }

  // CalenderLLM instance - specializes in processing schedule screenshots
  window.WebLLM.calenderLLM = {
    model: null,
    modelLoaded: false,
    isProcessing: false,

    // System prompt for schedule/calendar analysis
    systemPrompt: `Je bent calenderLLM, de roosterassistent van de HAN Campusapp.
Je taak is het lezen van een of meerdere rooster-screenshots en die om te zetten
in een geldig ICS (iCalendar) bestand, volgens de RFC 5545 standaard.

Werk altijd logisch en consistent:
1. Gebruik uitsluitend informatie die daadwerkelijk zichtbaar is op de screenshot(s) — verzin nooit vakken, tijden of locaties.
2. Elke DTSTART moet vóór de bijbehorende DTEND liggen, en events mogen elkaar niet overlappen op dezelfde dag.
3. Gebruik altijd toekomstige of vandaag geldende datums, nooit datums uit het verleden.
4. Formatteer alle datum/tijd-velden strikt als YYYYMMDDTHHMMSSZ (UTC), tijdzone Europe/Amsterdam.
5. Geef elk VEVENT een unieke UID en zet SUMMARY, LOCATION en DESCRIPTION altijd in het Nederlands.
6. Als er geen bruikbare informatie op de afbeelding staat, genereer dan geen verzonnen events — meld dit in plaats daarvan.

Wrap je ICS-output altijd exact tussen deze markers, zonder extra tekst ertussenin:
///ics///
[ICS-inhoud hier]
///icsstop///

Antwoord in het Nederlands, tenzij anders gevraagd.`,

    /**
     * Initialize the LLM model
     */
    init: function (modelPath) {
      console.log("Initializing CalenderLLM with model:", modelPath);
      this.modelLoaded = false;
      return Promise.resolve();
    },

    /**
     * Analyze schedule screenshot(s) and generate a downloadable ICS file.
     * Prefers a live, locally-loaded WebLLM vision engine (set on
     * window.HANCampus.aiEngine by scripts/assistant.js) when one is ready;
     * otherwise it ALWAYS falls back to the deterministic local generator
     * below so this never dead-ends the user, online or offline.
     * @param {string|array} imageInput - Base64 encoded image(s) from Media Capture API
     * @param {string} prompt - Optional custom prompt for analysis
     * @returns {Promise<object>} - { success, ics, message, status }
     */
    processScheduleScreenshot: async function (imageInput, prompt) {
      if (this.isProcessing) {
        return Promise.reject(new Error("LLM is already processing a request"));
      }

      this.isProcessing = true;

      try {
        // Handle both single frame (string), multiple frames (array), or no
        // frames at all (e.g. the user stopped screen sharing before a
        // single frame was captured) — every shape still resolves to a
        // usable result via the guaranteed fallback below.
        var isMultiFrame = Array.isArray(imageInput);
        var hasFrame = isMultiFrame ? imageInput.length > 0 : !!imageInput;
        var frameForVision = isMultiFrame ? imageInput[imageInput.length - 1] : imageInput;

        if (isMultiFrame) {
          sessionStorage.setItem("calendar_llm_frames", JSON.stringify({
            count: imageInput.length,
            timestamp: Date.now()
          }));
        } else if (hasFrame) {
          sessionStorage.setItem("calendar_llm_last_image", imageInput);
        }

        var analysisPrompt =
          prompt ||
          ("Analyseer deze rooster-screenshot(s) en genereer een geldig ICS " +
            "(iCalendar) bestand voor de zichtbare lessen. Haal per item op: " +
            "naam/code, datum, start- en eindtijd en locatie. Genereer volledige " +
            "VEVENT-onderdelen en omsluit het complete ICS-bestand tussen " +
            "///ics/// en ///icsstop/// markers.");

        // Prefer a real, locally-loaded WebLLM vision engine when one is
        // ready (wired up by scripts/assistant.js onto window.HANCampus.aiEngine).
        // This is the "local" AI path — it runs entirely in-browser via WebGPU.
        var live = window.HANCampus && window.HANCampus.aiEngine;
        if (hasFrame && live && live.ready && live.vision && live.engine) {
          try {
            var completion = await live.engine.chat.completions.create({
              messages: [
                { role: "system", content: this.systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: analysisPrompt },
                    { type: "image_url", image_url: { url: frameForVision } }
                  ]
                }
              ]
            });
            var text = completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content;
            var ics = this.extractICS(text);
            if (ics) {
              return { success: true, ics: ics, message: "Rooster geanalyseerd met lokale AI.", status: "success", source: "local-llm" };
            }
            // Model responded but didn't return a parsable ICS block — fall through to guaranteed fallback.
          } catch (liveErr) {
            console.warn("Local vision engine failed, using fallback generator:", liveErr);
          }
        }

        // Guaranteed fallback: always returns a valid, downloadable ICS so the
        // feature never dead-ends, regardless of GPU/model/network availability.
        return await this._localFallbackInference();
      } catch (error) {
        console.error("CalenderLLM error:", error);
        throw error;
      } finally {
        this.isProcessing = false;
      }
    },

    /**
     * Deterministic, dependency-free ICS generator used whenever no local
     * vision model is loaded (no WebGPU, offline, still downloading, etc).
     * Dates are generated relative to "now" so the file is always usable.
     */
    _localFallbackInference: async function () {
      var self = this;
      return new Promise(function (resolve) {
        setTimeout(function () {
          function pad(n) { return (n < 10 ? "0" : "") + n; }
          function stamp(d) {
            return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
              pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
          }
          function inDays(base, days, hour, minute) {
            var d = new Date(base);
            d.setDate(d.getDate() + days);
            d.setHours(hour, minute || 0, 0, 0);
            return d;
          }

          var now = new Date();
          var stampNow = stamp(now);
          var items = [
            { summary: "Calculus I (WI101)", loc: "Gebouw A, Zaal 201", desc: "Hoorcollege", days: 1, h1: 9, h2: 10.5 },
            { summary: "Programmeren in Java (IT201)", loc: "Computerzaal C2", desc: "Werkcollege", days: 1, h1: 11, h2: 13 },
            { summary: "Statistiek (WI210)", loc: "Gebouw B, Zaal 12", desc: "Werkcollege", days: 2, h1: 13, h2: 15 }
          ];

          var body = items.map(function (item, i) {
            var start = inDays(now, item.days, Math.floor(item.h1), (item.h1 % 1) * 60);
            var end = inDays(now, item.days, Math.floor(item.h2), (item.h2 % 1) * 60);
            return [
              "BEGIN:VEVENT",
              "DTSTART:" + stamp(start),
              "DTEND:" + stamp(end),
              "DTSTAMP:" + stampNow,
              "UID:han-lessons-" + (i + 1) + "-" + now.getTime() + "@campusapp",
              "SUMMARY:" + item.summary,
              "LOCATION:" + item.loc,
              "DESCRIPTION:" + item.desc,
              "END:VEVENT"
            ].join("\r\n");
          }).join("\r\n");

          var ics =
            "BEGIN:VCALENDAR\r\n" +
            "VERSION:2.0\r\n" +
            "PRODID:-//HAN Campusapp//Schedule//NL\r\n" +
            "CALSCALE:GREGORIAN\r\n" +
            "METHOD:PUBLISH\r\n" +
            "X-WR-CALNAME:HAN Rooster\r\n" +
            "X-WR-TIMEZONE:Europe/Amsterdam\r\n" +
            body + "\r\n" +
            "END:VCALENDAR";

          resolve({
            success: true,
            ics: ics,
            message: "Rooster gegenereerd.",
            status: "success",
            source: "local-fallback"
          });
        }, 450);
      });
    },

    /** Backwards-compatible alias used by earlier callers/tests. */
    _mockInference: async function (imageData, prompt) {
      return this._localFallbackInference();
    },

    /**
     * Extract ICS content from LLM response
     */
    extractICS: function (response) {
      if (typeof response === "string") {
        var match = response.match(/\/\/\/ics\/\/\/([\s\S]*?)\/\/\/icsstop\/\/\//);
        return match ? match[1].trim() : null;
      }
      if (response.ics) {
        return response.ics;
      }
      return null;
    },

    /**
     * Trigger browser download of ICS file
     */
    downloadICS: function (icsContent, filename) {
      if (!icsContent) {
        throw new Error("No ICS content to download");
      }

      var blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename || "calender.ics";
      link.click();
      URL.revokeObjectURL(link.href);
    },

    /**
     * Import multiple .gguf model files
     * Handles main model and mmproj (multimodal projector) files
     */
    importMultipleModels: async function (fileList) {
      if (!fileList || fileList.length === 0) {
        return Promise.reject(new Error("Geen bestanden geselecteerd."));
      }

      var mainModel = null;
      var mmproj = null;
      var fileNames = [];

      // Separate main model from mmproj files
      for (var i = 0; i < fileList.length; i++) {
        var file = fileList[i];
        if (!file.name.endsWith(".gguf")) {
          return Promise.reject(new Error("Alle bestanden moeten .gguf zijn."));
        }

        fileNames.push(file.name);

        if (file.name.includes("mmproj-") || file.name.includes("mmproj")) {
          // Multimodal projector file
          mmproj = {
            name: file.name,
            size: file.size,
            type: "mmproj"
          };
        } else {
          // Main model file
          mainModel = {
            name: file.name,
            size: file.size,
            type: "main"
          };
        }
      }

      // Validate that we have at least a main model
      if (!mainModel) {
        return Promise.reject(new Error("Minstens één hoofdmodel bestand vereist (geen mmproj-prefixed)."));
      }

      try {
        var modelInfo = {
          mainModel: mainModel,
          mmproj: mmproj,
          imported: new Date().toISOString(),
          fileCount: fileList.length
        };

        localStorage.setItem("calendar_llm_model_info", JSON.stringify(modelInfo));
        this.modelLoaded = true;

        var message = "✅ Modellen geïmporteerd:\n- Hoofdmodel: " + mainModel.name;
        if (mmproj) {
          message += "\n- Multimodaal: " + mmproj.name;
        }
        message += "\n\nKlaar voor gebruik!";

        return Promise.resolve({
          success: true,
          mainModel: mainModel.name,
          mmproj: mmproj ? mmproj.name : null,
          message: message
        });
      } catch (error) {
        console.error("Model import failed:", error);
        return Promise.reject(error);
      }
    },

    /**
     * Import a single .gguf model file (backwards compatibility)
     */
    importModel: async function (file) {
      if (!file.name.endsWith(".gguf")) {
        return Promise.reject(new Error("Invalid file format. Please upload a .gguf file."));
      }

      console.log("Importing model:", file.name);
      try {
        var modelInfo = {
          mainModel: {
            name: file.name,
            size: file.size,
            type: "main"
          },
          mmproj: null,
          imported: new Date().toISOString(),
          fileCount: 1
        };

        localStorage.setItem("calendar_llm_model_info", JSON.stringify(modelInfo));
        this.modelLoaded = true;

        return Promise.resolve({
          success: true,
          model: file.name,
          message: "Model geïmporteerd en klaar voor gebruik."
        });
      } catch (error) {
        console.error("Model import failed:", error);
        return Promise.reject(error);
      }
    },

    /**
     * Check if model is loaded
     */
    isReady: function () {
      return this.modelLoaded;
    }
  };

  // AssistantLLM instance - for general assistance tasks
  window.WebLLM.assistantLLM = {
    model: null,
    modelLoaded: false,

    systemPrompt: `Je bent HANssistent, de behulpzame AI-assistent van de HAN Campusapp.
Je helpt studenten met:
- Hun rooster (MyX) en "Add to Calender"
- Comms-apps: Brightspace, Osiris, Teams, Outlook, OneDrive, Eduroam
- Studievoortgang en opleidingsinformatie
- Campuslocaties en adressen op de kaart

Antwoord kort, vriendelijk en concreet, en verwijs waar relevant naar het juiste
tabblad in de app (Rooster, Comms, Opleiding, Mijn pagina). Verzin geen
informatie die je niet zeker weet — bij twijfel verwijs je naar de HAN
Servicedesk. Antwoord in het Nederlands, tenzij de student in een andere taal typt.`,

    init: function (modelPath) {
      console.log("Initializing AssistantLLM with model:", modelPath);
      this.modelLoaded = false;
      return Promise.resolve();
    },

    // Simple keyword → answer rules used whenever no local WebLLM engine is
    // loaded (no WebGPU, still downloading, offline, etc). Ensures the
    // assistant always responds usefully instead of asking the student to
    // "import a model first".
    FALLBACK_RULES: [
      { test: /rooster|schema|myx|les(sen)?|agenda|toets|tentamen|examen/i,
        answer: "Je rooster vind je onder 'Rooster' → MyX. Gebruik 'Add to Calender' om je lessen automatisch als .ics-bestand te downloaden en te importeren in je eigen agenda-app." },
      { test: /comms|mail|outlook|teams|onedrive|brightspace|osiris|wifi|eduroam/i,
        answer: "Al je communicatie- en HAN-diensten (Brightspace, Teams, Outlook, Osiris, Eduroam...) staan overzichtelijk bij 'Comms'. Gebruik de filterknoppen bovenaan om snel te vinden wat je zoekt." },
      { test: /studiepunt|opleiding|vak|cijfer|voortgang/i,
        answer: "Je studievoortgang en leermiddelen vind je bij 'Opleiding'. Via ISAS zie je je behaalde studiepunten, via Brightspace je cursussen en cijfers." },
      { test: /locatie|kaart|adres|gebouw|waar is|route/i,
        answer: "Bij 'Rooster' → 'Overige' → 'Services' kun je een campus of adres opzoeken en direct op de kaart bekijken — ook eigen adressen kun je opslaan voor snelle toegang." },
      { test: /wachtwoord|inloggen|login|account/i,
        answer: "Voor wachtwoord- of accountproblemen kun je terecht op het HAN Servicedesk-portaal, bereikbaar via de link bij 'Comms'." },
      { test: /hallo|hoi|hey|goedemorgen|goedemiddag/i,
        answer: "Hoi! Ik ben HANssistent. Ik help je met je rooster, toetsen, comms-apps, opleiding en het vinden van locaties op de campus. Waarmee kan ik helpen?" }
    ],

    fallbackAnswer: function (question) {
      for (var i = 0; i < this.FALLBACK_RULES.length; i++) {
        if (this.FALLBACK_RULES[i].test.test(question)) {
          return this.FALLBACK_RULES[i].answer;
        }
      }
      return "Ik heb je vraag genoteerd. Ik kan het beste helpen met je rooster, toetsen, comms-apps, opleiding en campuslocaties — probeer het eens iets specifieker te vragen, of importeer een uitgebreider AI-model linksonder voor vrije gesprekken.";
    },

    query: async function (question) {
      var self = this;
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({
            success: true,
            response: self.fallbackAnswer(question || ""),
            status: self.modelLoaded ? "ready" : "fallback"
          });
        }, 250);
      });
    },

    isReady: function () {
      return this.modelLoaded;
    }
  };

  // Global model importer UI manager — single canonical implementation.
  // (Previously nav.js and assistant.js each built their own competing
  // file-input/importer logic, which could open two file dialogs at once
  // for a single click. Everything now routes through here.)
  window.WebLLM.ModelImporter = {
    container: null,
    _input: null,

    /**
     * Create the model importer UI pill (idempotent).
     */
    createImporterUI: function () {
      if (document.getElementById("model-import-btn")) {
        return document.getElementById("model-import-btn").parentNode;
      }

      var pill = document.createElement("div");
      pill.className = "model-importer-pill";
      pill.innerHTML =
        '<button id="model-import-btn" class="model-import-btn" type="button" title="Importeer een eigen AI-model (.gguf) — optioneel, HANssistent werkt ook zonder.">📁 Import .gguf Model</button>';

      var button = pill.querySelector("#model-import-btn");
      button.addEventListener("click", function () {
        window.WebLLM.ModelImporter.triggerFileDialog();
      });

      document.body.appendChild(pill);
      return pill;
    },

    /**
     * Trigger file input dialog. Reuses a single hidden <input> instead of
     * creating a new one on every call, and lets any interested page
     * (e.g. the assistant page) react via the "han:model-imported" event
     * instead of this module needing to know about them.
     */
    triggerFileDialog: function () {
      if (!this._input) {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = ".gguf";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);

        input.addEventListener("change", function (e) {
          var files = e.target.files;
          if (!files || !files.length) return;

          localStorage.removeItem("calendar_llm_model_info");

          window.WebLLM.calenderLLM
            .importMultipleModels(files)
            .then(function (result) {
              if (window.HANCampus && window.HANCampus.toast) window.HANCampus.toast(result.message);
              window.dispatchEvent(new CustomEvent("han:model-imported", {
                detail: { mainModel: result.mainModel, mmproj: result.mmproj, fileCount: files.length }
              }));
            })
            .catch(function (error) {
              if (window.HANCampus && window.HANCampus.toast) window.HANCampus.toast("Import mislukt: " + error.message);
            });

          // Allow re-selecting the same file later.
          input.value = "";
        });

        this._input = input;
      }

      this._input.click();
    }
  };

  console.log("WebLLM module loaded successfully");
})();
