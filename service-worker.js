const CACHE_NAME = "invincit-cache-v2.0.1";
const STATIC_CACHE_NAME = "invincit-static-v2.0.1";
const DYNAMIC_CACHE_NAME = "invincit-dynamic-v2.0.1";

// URLs críticas que DEBEN cachearse (rutas relativas)
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/normalize.css",
  "/css/webflow.css", 
  "/css/ut-ayuda.webflow.css",
  "/js/webflow.js"
];

// Iconos críticos (solo los que EXISTEN)
const ICON_CACHE = [
  "/images/favicon.ico",
  "/images/webclip.png",
  "/images/111111111111111111111111111111111111111111111111.PNG"
];

// URLs externas (verificar disponibilidad)
const EXTERNAL_CACHE = [
  "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap",
  "https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js",
  "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js"
];

// ========== INSTALL EVENT ==========
self.addEventListener("install", event => {
  console.log("🔧 Service Worker: Instalando v2.0.1...");
  
  event.waitUntil(
    Promise.allSettled([
      // Cache recursos críticos
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log("📦 Cacheando recursos críticos...");
        return Promise.allSettled(
          [...URLS_TO_CACHE, ...ICON_CACHE].map(url => 
            cache.add(new Request(url, {cache: 'reload'}))
              .catch(err => {
                console.warn(`⚠️ No se pudo cachear: ${url}`, err.message);
                return null; // Continuar sin fallar
              })
          )
        );
      }),
      
      // Cache recursos externos (sin fallar)
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        console.log("🌐 Intentando cachear recursos externos...");
        return Promise.allSettled(
          EXTERNAL_CACHE.map(url => 
            fetch(url, {mode: 'cors', cache: 'reload'})
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                throw new Error(`Response not ok: ${response.status}`);
              })
              .catch(err => {
                console.warn(`⚠️ Recurso externo no disponible: ${url}`, err.message);
                return null;
              })
          )
        );
      })
    ]).then(() => {
      console.log("✅ Service Worker: Instalación completada");
      return self.skipWaiting();
    })
  );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener("activate", event => {
  console.log("🚀 Service Worker: Activando v2.0.1...");
  
  event.waitUntil(
    Promise.all([
      // Limpiar cachés antiguos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                (cacheName.startsWith("invincit-") || cacheName.startsWith("mi-cache-"))) {
              console.log(`🗑️ Eliminando caché antiguo: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar control inmediato
      self.clients.claim()
    ]).then(() => {
      console.log("✅ Service Worker: Activado y en control v2.0.1");
    })
  );
});

// ========== FETCH EVENT ==========
self.addEventListener("fetch", event => {
  // Solo manejar requests HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignorar requests del chrome-extension
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Estrategia basada en el tipo de recurso
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

// ========== ESTRATEGIAS DE CACHE ==========

// Cache First - Para recursos estáticos
async function cacheFirst(request) {
  try {
    // Buscar en cache primero
    const cached = await caches.match(request);
    if (cached) {
      console.log(`📦 Cache hit: ${request.url}`);
      return cached;
    }
    
    // Si no está en cache, intentar descargar
    console.log(`🌐 Descargando: ${request.url}`);
    const response = await fetch(request);
    
    // Solo cachear respuestas exitosas
    if (response.ok && response.status < 400) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
      console.log(`💾 Cacheado: ${request.url}`);
    }
    
    return response;
    
  } catch (error) {
    console.error(`❌ Error en cacheFirst para ${request.url}:`, error.message);
    
    // Fallback para páginas HTML
    if (request.destination === 'document') {
      const cached = await caches.match('/index.html');
      if (cached) {
        console.log("📄 Sirviendo index.html como fallback");
        return cached;
      }
    }
    
    // Response de error
    return new Response('Recurso no disponible offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {'Content-Type': 'text/plain'}
    });
  }
}

// Network First - Para contenido dinámico
async function networkFirst(request) {
  try {
    console.log(`🌐 Red primero: ${request.url}`);
    const response = await fetch(request);
    
    // Cachear respuestas exitosas
    if (response.ok && response.status < 400) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
      console.log(`💾 Actualizado en cache: ${request.url}`);
    }
    
    return response;
    
  } catch (error) {
    console.log(`📱 Red falló, buscando en cache: ${request.url}`);
    
    // Buscar en cualquier cache
    const cached = await caches.match(request);
    if (cached) {
      console.log(`📦 Cache fallback: ${request.url}`);
      return cached;
    }
    
    console.error(`❌ No encontrado: ${request.url}`);
    
    // Response de error para recursos no críticos
    return new Response('No disponible offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {'Content-Type': 'text/plain'}
    });
  }
}

// ========== UTILIDADES ==========

function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Recursos estáticos por extensión
  if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/i)) {
    return true;
  }
  
  // Páginas HTML y manifest
  if (request.destination === 'document' || pathname.includes('manifest.json')) {
    return true;
  }
  
  // Fontes de Google
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return true;
  }
  
  return false;
}

// ========== MANEJO DE MENSAJES ==========
self.addEventListener('message', event => {
  console.log('📨 Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log("🔄 Forzando actualización del Service Worker");
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      static: STATIC_CACHE_NAME,
      dynamic: DYNAMIC_CACHE_NAME
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log("🧹 Limpiando cache manualmente");
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      console.log("✅ Cache limpiado");
    });
  }
});

// ========== NOTIFICACIONES PUSH ==========
self.addEventListener('push', event => {
  console.log('📢 Push recibido:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación de INVINCIT',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-144x144.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('INVINCIT', options)
  );
});

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', event => {
  console.log("🔄 Background sync:", event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log("🔄 Ejecutando sincronización en segundo plano");
  try {
    // Aquí puedes implementar lógica para enviar datos pendientes
    console.log("✅ Sincronización completada");
  } catch (error) {
    console.error("❌ Error en background sync:", error);
  }
}

console.log("🎯 Service Worker INVINCIT v2.0.1 - Errores corregidos");