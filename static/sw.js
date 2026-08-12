// Ålgård Karate – minimal service worker
//
// This exists mainly to satisfy browser PWA "installability" criteria
// (Chrome/Android requires a registered service worker with a fetch
// handler before it will offer the native install prompt). It does a
// lightweight network-first pass-through with no offline caching, so it
// won't ever serve stale content.

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
