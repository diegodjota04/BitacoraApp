/**
 * Service Worker - Bitácora Escolar v2.0
 * Habilita funcionamiento offline y mejora el rendimiento
 */

const CACHE_NAME = 'bitacora-v2.1';

// Recursos a cachear para funcionamiento offline
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css',
    './css/components.css',
    './js/config.js',
    './js/security.js',
    './js/error-handler.js',
    './js/validators.js',
    './js/storage.js',
    './js/student-manager.js',
    './js/session-manager.js',
    './js/pdf-generator.js',
    './js/statistics.js',
    './js/ui-manager.js',
    './js/app.js',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// CDN resources (Bootstrap, FontAwesome, jsPDF)
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ─── Install: cachear todos los recursos estáticos ────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Cacheando recursos estáticos...');
            // Cachear locales con requireAll
            const localPromise = cache.addAll(STATIC_ASSETS);
            // Cachear CDN ignorando errores individuales
            const cdnPromises = CDN_ASSETS.map(url =>
                cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err))
            );
            return Promise.all([localPromise, ...cdnPromises]);
        }).then(() => {
            console.log('[SW] Instalación completada');
            return self.skipWaiting();
        })
    );
});

// ─── Activate: limpiar cachés viejos ─────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Eliminando caché antiguo:', name);
                        return caches.delete(name);
                    })
            )
        ).then(() => {
            console.log('[SW] Activado y controlando todas las pestañas');
            return self.clients.claim();
        })
    );
});

// ─── Fetch: estrategia Cache First con fallback a red ────────────────────────
self.addEventListener('fetch', event => {
    // Solo manejar GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Para navegación: Network First (siempre intenta la red primero)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Guardar copia fresca en caché
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Para el resto: Cache First
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then(response => {
                // No cachear respuestas inválidas
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => {
                // Fallback para imágenes
                if (event.request.destination === 'image') {
                    return caches.match('./icons/icon-192x192.png');
                }
            });
        })
    );
});
