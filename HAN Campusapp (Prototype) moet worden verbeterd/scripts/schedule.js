/**
 * schedule.js — /schedule/index.html
 *
 * - "View my Schedule" shows a right-click context menu with:
 *   - "View Schedule" (opens han.myx.nl in new tab)
 *   - "View Schedule & Import" (captures screenshot, generates ICS file)
 * - "Add to Calendar" (centered button) captures schedule and generates downloadable ICS file
 * - Media Capture API grabs a single screenshot and sends to calenderLLM
 * - CalenderLLM generates valid ICS file wrapped in ///ics/// markers
 * - Browser prompts download of .ics file
 */
(function () {
  "use strict";

  var SCHEDULE_URL = "https://han.myx.nl/";
  var CAPTURE_KEY = "han_schedule_capture";

  document.addEventListener("DOMContentLoaded", function () {
    var viewBtn = document.getElementById("view-schedule-btn");
    var calendarBtn = document.getElementById("add-to-calendar-btn");

    // Remove iframe/consent overlay elements if they exist
    var consentOverlay = document.getElementById("consent-overlay");
    var frameOverlay = document.getElementById("frame-overlay");
    if (consentOverlay) consentOverlay.remove();
    if (frameOverlay) frameOverlay.remove();

    // View Schedule button - right-click context menu
    if (viewBtn) {
      viewBtn.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        showScheduleContextMenu(e.clientX, e.clientY);
      });

      // Left-click also opens menu for better UX
      viewBtn.addEventListener("click", function (e) {
        e.preventDefault();
        showScheduleContextMenu(e.clientX, e.clientY);
      });
    }

    // Add to Calendar button - direct capture flow
    if (calendarBtn) {
      calendarBtn.addEventListener("click", function () {
        captureAndGenerateICS("add-to-calendar");
      });
    }

    /**
     * Show context menu for schedule options
     */
    function showScheduleContextMenu(x, y) {
      // Remove existing menu
      var existing = document.querySelector(".schedule-context-menu");
      if (existing) existing.remove();

      var menu = document.createElement("div");
      menu.className = "schedule-context-menu";
      menu.style.position = "fixed";
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      menu.style.zIndex = "1000";
      menu.style.backgroundColor = "white";
      menu.style.border = "1px solid #ccc";
      menu.style.borderRadius = "4px";
      menu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      menu.style.minWidth = "200px";

      var option1 = document.createElement("button");
      option1.textContent = "View Schedule";
      option1.style.display = "block";
      option1.style.width = "100%";
      option1.style.padding = "10px 14px";
      option1.style.border = "none";
      option1.style.background = "none";
      option1.style.textAlign = "left";
      option1.style.cursor = "pointer";
      option1.style.fontSize = "14px";
      option1.style.borderBottom = "1px solid #eee";

      option1.addEventListener("click", function () {
        menu.remove();
        // Immediately invoke Media Capture API
        captureForViewSchedule();
      });

      option1.addEventListener("mouseenter", function () {
        option1.style.backgroundColor = "#f5f5f5";
      });

      option1.addEventListener("mouseleave", function () {
        option1.style.backgroundColor = "transparent";
      });

      var option2 = document.createElement("button");
      option2.textContent = "View Schedule & Import";
      option2.style.display = "block";
      option2.style.width = "100%";
      option2.style.padding = "10px 14px";
      option2.style.border = "none";
      option2.style.background = "none";
      option2.style.textAlign = "left";
      option2.style.cursor = "pointer";
      option2.style.fontSize = "14px";

      option2.addEventListener("click", function () {
        menu.remove();
        captureAndGenerateICS("view-and-import");
      });

      option2.addEventListener("mouseenter", function () {
        option2.style.backgroundColor = "#f5f5f5";
      });

      option2.addEventListener("mouseleave", function () {
        option2.style.backgroundColor = "transparent";
      });

      menu.appendChild(option1);
      menu.appendChild(option2);
      document.body.appendChild(menu);

      // Close menu when clicking elsewhere
      setTimeout(function () {
        document.addEventListener("click", function closeMenu() {
          if (menu.parentNode) menu.remove();
          document.removeEventListener("click", closeMenu);
        });
      }, 0);
    }

    /**
     * Capture for View Schedule: Immediately invoke Media Capture API
     * If successful, auto-open new tab. If fails, show error.
     */
    async function captureForViewSchedule() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        window.HANCampus.toast("Schermopname wordt niet ondersteund in deze browser.");
        return;
      }

      window.HANCampus.toast("Schermopname wordt gestart...");

      try {
        var stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            displaySurface: "monitor",
            cursor: "hide"
          },
          audio: false
        });

        // Media Capture successful - auto-open new tab
        window.open(SCHEDULE_URL, "_blank");

        // Stop the stream
        stream.getTracks().forEach(function (t) {
          t.stop();
        });

        window.HANCampus.toast("Rooster geopend in nieuw tabblad.");
      } catch (err) {
        // Try fallback to browser surface if monitor fails
        if (err.name !== "NotAllowedError") {
          try {
            var fallbackStream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser" },
              audio: false,
              preferCurrentTab: true
            });
            window.open(SCHEDULE_URL, "_blank");
            fallbackStream.getTracks().forEach(function (t) {
              t.stop();
            });
            window.HANCampus.toast("Rooster geopend (tabmodus).");
          } catch (fallbackErr) {
            window.HANCampus.toast("Schermopname niet beschikbaar in deze browser.");
          }
        }
      }
    }

    /**
     * Capture screen and generate ICS file
     * Captures frames every second for up to 15 seconds
     */
    async function captureAndGenerateICS(action) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        window.HANCampus.toast("Schermopname wordt niet ondersteund in deze browser.");
        return;
      }

      window.HANCampus.toast("Klik op 'Delen' om toestemming te geven voor schermopname.");

      var stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
              displaySurface: "monitor"
            },
            audio: false
          });
        } catch (err) {
        if (err.name !== "NotAllowedError") {
          window.HANCampus.toast("Schermopname geannuleerd.");
        }
        return;
      }

      try {
        var track = stream.getVideoTracks()[0];
        var capture = new ImageCapture(track);
        var frames = [];
        var frameCount = 0;
        var maxFrames = 15;
        var finished = false;

        window.HANCampus.toast("Frames vastleggen...");

        /**
         * Wrap up capture and hand whatever frames we have to the AI
         * pipeline. Called on normal completion (15 frames), when the
         * user stops sharing early via the browser's own "Stop sharing"
         * control, or when a grab fails mid-way — in every case the
         * frames captured so far are still analyzed instead of being
         * discarded, so an early stop never throws the result away.
         */
        function finish(reason) {
          if (finished) return;
          finished = true;
          clearInterval(frameInterval);
          stream.getTracks().forEach(function (t) {
            t.stop();
          });

          if (!frames.length) {
            window.HANCampus.toast("Geen frames vastgelegd — ik gebruik het standaard roosterformaat.");
          } else if (reason === "early") {
            window.HANCampus.toast("Schermdelen gestopt — AI werkt verder met de " + frames.length + " vastgelegde frame(s).");
          }

          // Stash the last frame so the assistant page can offer to
          // analyze it too ("Ask HANssistent" → calenderLLM mode).
          if (frames.length) {
            sessionStorage.setItem(CAPTURE_KEY, frames[frames.length - 1]);
          }

          // Send whatever frames we have to CalenderLLM. processMultipleFrames
          // and the underlying guaranteed fallback both handle an empty
          // array gracefully, so this always produces a usable .ics file.
          processMultipleFrames(frames);
        }

        // User stopped sharing early via the browser's native UI/shortcut.
        track.addEventListener("ended", function () {
          finish("early");
        });

        // Capture frames every second for up to 15 seconds
        var frameInterval = setInterval(async function () {
          if (finished) return;
          try {
            if (frameCount < maxFrames && track.readyState === "live") {
              var bitmap = await capture.grabFrame();
              var canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              var ctx = canvas.getContext("2d");
              ctx.drawImage(bitmap, 0, 0);
              var base64 = canvas.toDataURL("image/png");
              frames.push(base64);
              frameCount++;
            } else {
              finish(frameCount >= maxFrames ? "complete" : "early");
            }
          } catch (err) {
            // A grab failure usually means the track ended mid-capture —
            // still finish with whatever frames we already have rather
            // than just showing an error and losing all progress.
            console.warn("Frame capture stopped early:", err);
            finish("early");
          }
        }, 1000);

      } catch (err) {
        window.HANCampus.toast("Kon schermopname niet starten.");
        console.error("Capture error:", err);
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
      }
    }

    /**
     * Process multiple frames with CalenderLLM
     */
    function processMultipleFrames(frames) {
      if (!window.WebLLM || !window.WebLLM.calenderLLM) {
        // Should not happen — kept as a defensive last resort so the user
        // is never met with total silence if something upstream changes.
        window.HANCampus.toast("AI-module niet beschikbaar. Ververs de pagina en probeer opnieuw.");
        return;
      }

      window.HANCampus.toast("Rooster analyseren (" + frames.length + " frames)...");

      // Process all frames with LLM to filter relevant content. This always
      // resolves — either with a real local-model analysis or the
      // guaranteed local fallback generator — so the user always ends up
      // with a usable .ics file.
      window.WebLLM.calenderLLM
        .processScheduleScreenshot(frames)
        .then(function (result) {
          var icsContent = window.WebLLM.calenderLLM.extractICS(result);

          if (icsContent) {
            window.WebLLM.calenderLLM.downloadICS(icsContent, "rooster.ics");
            window.HANCampus.toast("Rooster gedownload! Importeer in je kalender.");
            sessionStorage.setItem("calendar_llm_result", JSON.stringify(result));
          } else {
            window.HANCampus.toast("Geen geldige kalendergegevens herkend op de screenshot.");
          }
        })
        .catch(function (error) {
          console.error("LLM processing error:", error);
          window.HANCampus.toast("AI-verwerking mislukt: " + (error && error.message ? error.message : "onbekende fout"));
        });
    }
  });
})();
