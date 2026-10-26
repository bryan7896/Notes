// Service worker mínimo: cachea el shell de la app para que abra offline.
// La data (tareas) siempre se pide a la red — nunca se sirve desde cache,
// porque necesitamos el estado real del Sheet.
const CACHE_NAME = "notas-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/config.js",
  "./js/app.js",
  "./js/task-modal.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear llamadas al backend (Apps Script): siempre red.
  if (url.hostname.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
