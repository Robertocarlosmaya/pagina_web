// INVINCIT - Service Worker
// ========================

const CACHE_NAME = 'invincit-v1.2.0';
const STATIC_CACHE_NAME = 'invincit-static-v1.2.0';

// Solo archivos que SABEMOS que existen
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/script.js',
    './manifest.json'
];

// URLs que siempre deben ir a la red
const NETWORK_ONLY = [
    '/api/',
    '/admin/',
    '/upload/'
];

// ===================================
// EVENTOS DEL SERVICE WORKER
// ===================================

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker: Instalando...');
    
    event.waitUntil(
        cacheStaticAssets()
            .then(() => {
                console.log('[SW] Service Worker: Instalación completada');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Service Worker: Error en instalación:', error);
                // Continuar de todos modos
                return self.skipWaiting();
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker: Activando...');
    
    event.waitUntil(
        Promise.all([
            cleanupOldCaches(),
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] Service Worker: Activación completada');
        }).catch(error => {
            console.error('[SW] Service Worker: Error en activación:', error);
        })
    );
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    // Ignorar peticiones no HTTP/HTTPS
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Estrategia simple: Network first con cache fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                // Si la respuesta es exitosa, cachearla
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(STATIC_CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, buscar en caché
                return caches.match(request).then(cachedResponse => {
                    return cachedResponse || new Response('Sin conexión', {
                        status: 503,
                        statusText: 'Sin conexión'
                    });
                });
            })
    );
});

// Manejo de mensajes desde la aplicación principal
self.addEventListener('message', (event) => {
    console.log('[SW] Service Worker: Mensaje recibido:', event.data);
    
    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'CACHE_REPORT':
            cacheReport(event.data.payload);
            break;
        case 'GET_CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0].postMessage(status);
            });
            break;
        default:
            console.log('Tipo de mensaje no reconocido:', event.data.type);
    }
});

// Notificaciones push
self.addEventListener('push', (event) => {
    console.log('[SW] Service Worker: Push recibido');
    
    const options = {
        body: event.data ? event.data.text() : 'Nuevo reporte recibido',
        icon: './images/icons/icon-192.png',
        badge: './images/icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: './'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('INVINCIT', options)
    );
});

// Click en notificaciones
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Service Worker: Click en notificación');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url || './')
    );
});

// ===================================
// FUNCIONES DE CACHÉ SIMPLIFICADAS
// ===================================

async function cacheStaticAssets() {
    console.log('[SW] Cacheando recursos estáticos...');
    
    const cache = await caches.open(STATIC_CACHE_NAME);
    
    // Cachear individualmente para evitar que un archivo faltante rompa todo
    for (const asset of STATIC_ASSETS) {
        try {
            await cache.add(asset);
            console.log(`[SW] Cacheado: ${asset}`);
        } catch (error) {
            console.warn(`[SW] No se pudo cachear ${asset}:`, error.message);
            // Continuar con los demás archivos
        }
    }
    
    console.log('[SW] Proceso de cache completado');
}

async function cleanupOldCaches() {
    console.log('[SW] Limpiando cachés antiguos...');
    
    const cacheNames = await caches.keys();
    const validCaches = [STATIC_CACHE_NAME, CACHE_NAME];
    
    const deletePromises = cacheNames
        .filter(cacheName => !validCaches.includes(cacheName))
        .map(cacheName => {
            console.log(`[SW] Eliminando caché: ${cacheName}`);
            return caches.delete(cacheName);
        });
    
    await Promise.all(deletePromises);
    console.log('[SW] Limpieza de cachés completada');
}

// ===================================
// MANEJO DE ERRORES GLOBALES
// ===================================

self.addEventListener('error', (event) => {
    console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Service Worker unhandled rejection:', event.reason);
});

// ===================================
// LOGGING FINAL
// ===================================

console.log('[SW] Service Worker cargado correctamente');
console.log(`[SW] Caché principal: ${STATIC_CACHE_NAME}`);
console.log(`[SW] Recursos a cachear: ${STATIC_ASSETS.length}`);