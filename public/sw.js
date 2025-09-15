const CACHE_NAME = "schedulezap-v6";
const CACHE_STATIC = "schedulezap-static-v6";
const CACHE_DYNAMIC = "schedulezap-dynamic-v6";

const urlsToCache = [
  "/",
  "/login.html",
  "/app.js",
  "/manifest.json",
  "/icons/icon.svg",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
];

const MAX_DYNAMIC_CACHE_SIZE = 50;

// Função para limpar cache dinâmico
const limitCacheSize = (name, size) => {
  caches.open(name).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(limitCacheSize(name, size));
      }
    });
  });
};

// Install event
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Service Worker");
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => {
        console.log("[SW] Precaching app shell");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Fetch event
self.addEventListener("fetch", (event) => {
  // Só processar requisições GET
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Estratégia Cache First para recursos estáticos
  if (
    urlsToCache.some((cachedUrl) =>
      event.request.url.includes(cachedUrl.replace("/", ""))
    )
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // Network First para APIs
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // Em caso de erro de rede, tenta buscar no cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Estratégia Cache First com fallback para outras requisições
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((fetchResponse) => {
          // Não cacheia se não for uma resposta válida
          if (
            !fetchResponse ||
            fetchResponse.status !== 200 ||
            fetchResponse.type !== "basic"
          ) {
            return fetchResponse;
          }

          // Cache dinâmico para recursos não estáticos
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => {
            cache.put(event.request, responseToCache);
            limitCacheSize(CACHE_DYNAMIC, MAX_DYNAMIC_CACHE_SIZE);
          });

          return fetchResponse;
        })
        .catch(() => {
          // Fallback para página offline
          if (event.request.destination === "document") {
            return caches.match("/");
          }
        });
    })
  );
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating Service Worker");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== CACHE_STATIC &&
              cacheName !== CACHE_DYNAMIC &&
              cacheName !== CACHE_NAME
            ) {
              console.log("[SW] Deletando cache antigo:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Push notifications (preparando para futuras implementações)
self.addEventListener("push", (event) => {
  console.log("[SW] Push Received");

  const options = {
    body: event.data ? event.data.text() : "Nova mensagem agendada!",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: "2",
    },
    actions: [
      {
        action: "explore",
        title: "Ir para o app",
        icon: "/icons/icon.svg",
      },
      {
        action: "close",
        title: "Fechar",
        icon: "/icons/icon.svg",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification("ScheduleZAP", options));
});

// Background Sync (preparando para futuras implementações)
self.addEventListener("sync", (event) => {
  console.log("[SW] Background Sync");
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Implementar sincronização em background
  return Promise.resolve();
}
