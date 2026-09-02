/**
 * Service Worker — Intercepts requests to modify headers
 * Used to inject custom User-Agent and handle third-party cookie scenarios
 */

// Cache name for offline support
const CACHE_NAME = "han-campusapp-v1";
const SCHEDULE_CACHE = "han-schedule-cache";

// On install, skip waiting to activate immediately
self.addEventListener("install", function (event) {
  console.log("Service Worker installed");
  self.skipWaiting();
});

// On activate, claim clients immediately
self.addEventListener("activate", function (event) {
  console.log("Service Worker activated");
  event.waitUntil(self.clients.claim());
});

// Intercept fetch requests
self.addEventListener("fetch", function (event) {
  var request = event.request;
  
  // Handle schedule URL requests with modified headers
  if (request.url.includes("han.myx.nl") || request.url.includes("schedule")) {
    var modifiedRequest = new Request(request, {
      headers: new Headers(request.headers)
    });
    
    // Add or modify User-Agent header (note: some browsers block this)
    // Instead, we'll add additional headers that might help
    modifiedRequest.headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
    modifiedRequest.headers.set("Accept-Language", "nl-NL,nl;q=0.9");
    modifiedRequest.headers.set("Cache-Control", "no-cache");
    modifiedRequest.headers.set("Pragma", "no-cache");
    modifiedRequest.headers.set("Sec-Fetch-Dest", "iframe");
    modifiedRequest.headers.set("Sec-Fetch-Mode", "navigate");
    modifiedRequest.headers.set("Sec-Fetch-Site", "cross-site");
    
    event.respondWith(
      fetch(modifiedRequest)
        .then(function (response) {
          // Clone the response to store in cache
          var responseClone = response.clone();
          
          // Cache schedule responses
          if (request.url.includes("han.myx.nl")) {
            caches.open(SCHEDULE_CACHE).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(function (error) {
          console.log("Fetch failed; returning cached or offline page:", error);
          
          // Try to return cached response
          return caches.match(request)
            .then(function (response) {
              if (response) {
                return response;
              }
              // Return a basic offline page
              return new Response("<h1>Offline</h1><p>Kon verbinding niet maken. Controleer je internetverbinding.</p>", {
                headers: { "Content-Type": "text/html; charset=utf-8" },
                status: 503,
                statusText: "Service Unavailable"
              });
            });
        })
    );
  } else {
    // For other requests, use network first strategy
    event.respondWith(
      fetch(request)
        .then(function (response) {
          return response;
        })
        .catch(function () {
          return caches.match(request)
            .then(function (response) {
              return response || new Response("Not found", { status: 404 });
            });
        })
    );
  }
});

// Handle messages from clients
self.addEventListener("message", function (event) {
  if (event.data.action === "clearScheduleCache") {
    caches.delete(SCHEDULE_CACHE).then(function () {
      event.ports[0].postMessage({ success: true });
    });
  }
});
