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
    systemPrompt: `You are a helpful AI assistant specialized in analyzing university schedules and generating calendar entries.
Your task is to extract and interpret schedule information from screenshots and generate valid ICS (iCalendar) files.

When generating ICS files:
1. Parse all course/lesson information (name, code, time, date, location)
2. Generate VEVENT entries for each lesson
3. Ensure all fields are properly formatted according to RFC 5545 standard
4. Include DESCRIPTION field with any special notes

IMPORTANT: Wrap your ICS output between these markers:
///ics///
[ICS content here]
///icsstop///

Always respond in Dutch (Nederlands) unless otherwise specified.`,

    /**
     * Initialize the LLM model
     */
    init: function (modelPath) {
      console.log("Initializing CalenderLLM with model:", modelPath);
      this.modelLoaded = false;
      return Promise.resolve();
    },

     * @param {string|array} imageInput - Base64 encoded image(s) from Media Capture API
     * @param {string} prompt - Optional custom prompt for analysis
     * @returns {Promise<string>} - ICS file content
     */
    processScheduleScreenshot: async function (imageInput, prompt) {
      if (this.isProcessing) {
        return Promise.reject(new Error("LLM is already processing a request"));
      }

      this.isProcessing = true;
      try {
        // Handle both single frame (string) and multiple frames (array)
        var isMultiFrame = Array.isArray(imageInput);
        
        if (isMultiFrame) {
          // Multiple frames - use the first frame as the visual reference for the LLM
          // while providing all frames for full context/filtering
          var primaryFrame = imageInput[0];
          sessionStorage.setItem("calendar_llm_frames", JSON.stringify({
            count: imageInput.length,
            timestamp: Date.now()
          }));
          
          // If using a vision model, it needs the actual image data
          // We will pass the array to the inference logic
          var analysisPrompt =
            prompt ||
            `Analyze this series of ${imageInput.length} schedule screenshots and generate a valid ICS (iCalendar) file.
            Extract:
            1. All visible courses/lessons with names and codes
            2. Time slots and dates (use proper datetime format)
            3. Locations
            4. Lesson types (lecture, lab, tutorial, etc.)
            
            This is a sequence of frames captured over time. Analyze all frames and filter out duplicates, focusing on unique and relevant schedule information only.
            
            Generate complete VEVENT entries for each lesson. Wrap the complete ICS file between ///ics/// and ///icsstop/// markers.`;

          var result = await this._mockInference(imageInput, analysisPrompt);
          return result;
        } else {
          // Single frame
          sessionStorage.setItem("calendar_llm_last_image", imageInput);
          
          var analysisPrompt =
            prompt ||
            `Analyze this university schedule screenshot and generate a valid ICS (iCalendar) file.
            Extract:
            1. All visible courses/lessons with names and codes
            2. Time slots and dates (use proper datetime format)
            3. Locations
            4. Lesson types (lecture, lab, tutorial, etc.)
            
            Generate complete VEVENT entries for each lesson. Wrap the complete ICS file between ///ics/// and ///icsstop/// markers.`;

          var result = await this._mockInference(imageInput, analysisPrompt);
          return result;
        }
      } catch (error) {
        console.error("CalenderLLM error:", error);
        throw error;
      } finally {
        this.isProcessing = false;
      }
    },


    /**
     * Mock inference that generates a sample ICS file
     */
    _mockInference: async function (imageData, prompt) {
      // Simulate processing delay
      return new Promise(function (resolve) {
        setTimeout(function () {
          var sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HAN Campusapp//Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:HAN Rooster
X-WR-TIMEZONE:Europe/Amsterdam
BEGIN:VEVENT
DTSTART:20260902T090000Z
DTEND:20260902T105000Z
DTSTAMP:20260902T000000Z
UID:han-schedule-001@campusapp
SUMMARY:Calculus I (WI101)
LOCATION:Gebouw A, Zaal 201
DESCRIPTION:Wiskundig analyse - hoorcollege
END:VEVENT
BEGIN:VEVENT
DTSTART:20260902T110000Z
DTEND:20260902T130000Z
DTSTAMP:20260902T000000Z
UID:han-schedule-002@campusapp
SUMMARY:Programmeren in Java (IT201)
LOCATION:Computerzaal C2
DESCRIPTION:Praktische werkzitting - code implementatie
END:VEVENT
END:VCALENDAR`;

          resolve({
            success: true,
            ics: sampleICS,
            message: "ICS bestand gegenereerd. Download in progress...",
            status: "success"
          });
        }, 500);
      });
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

    systemPrompt: `You are HANssistent, a helpful AI assistant for HAN University students.
You provide support for:
- Academic questions and course information
- Campus navigation and location help
- Schedule planning and course selection
- General university services and resources

Always be friendly, supportive, and provide accurate information.
Respond in Dutch (Nederlands) unless the student writes in English.`,

    init: function (modelPath) {
      console.log("Initializing AssistantLLM with model:", modelPath);
      this.modelLoaded = false;
      return Promise.resolve();
    },

    query: async function (question) {
      // Placeholder for actual LLM query
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({
            success: true,
            response: "HANssistent is klaar om je vragen te beantwoorden. Importeer eerst een AI model.",
            status: "awaiting-model"
          });
        }, 300);
      });
    },

    isReady: function () {
      return this.modelLoaded;
    }
  };

  // Global model importer UI manager
  window.WebLLM.ModelImporter = {
    container: null,

    /**
     * Create the model importer UI pill
     */
    createImporterUI: function () {
      // Check if it already exists to prevent duplicates
      if (document.getElementById("model-import-btn")) {
        return document.getElementById("model-import-btn").parentNode;
      }

      var pill = document.createElement("div");
      pill.className = "model-importer-pill";
      pill.innerHTML =
        '<button id="model-import-btn" class="model-import-btn">📁 Import .gguf Model</button>';

      var button = pill.querySelector("#model-import-btn");
      button.addEventListener("click", ModelImporter.triggerFileDialog);

      document.body.appendChild(pill);
      return pill;
    },

    /**
     * Trigger file input dialog
     */
    triggerFileDialog: function () {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".gguf";
      input.multiple = false;

      input.addEventListener("change", function (e) {
        if (e.target.files.length > 0) {
          // Nuke previous model info to ensure a fresh import
          localStorage.removeItem("calendar_llm_model_info");
          
          window.WebLLM.calenderLLM
            .importModel(e.target.files[0])
            .then(function (result) {
              window.HANCampus.toast(result.message);
            })
            .catch(function (error) {
              window.HANCampus.toast("Model import failed: " + error.message);
            });
        }
      });

      input.click();
    }
  };

  console.log("WebLLM module loaded successfully");
})();
