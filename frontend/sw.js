// PC Service Pro - Service Worker
const CACHE_NAME = 'pc-service-pro-v1.0.0';
const CACHE_VERSION = '1.0.0';

// Files to cache for offline functionality
const CORE_CACHE_FILES = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/responsive.css',
    '/js/main.js',
    '/js/gallery.js',
    '/js/contact-form.js',
    '/assets/manifest.json'
];

// External resources to cache
const EXTERNAL_CACHE_FILES = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Image cache patterns
const IMAGE_CACHE_PATTERNS = [
    /\/images\//,
    /\/assets\//
];

// API endpoints that should use network-first strategy
const NETWORK_FIRST_PATTERNS = [
    /\/api\//,
    /contact/,
    /submit/
];

// Install event - cache core files
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core files');
                // Cache core files first
                return cache.addAll(CORE_CACHE_FILES);
            })
            .then(() => {
                // Cache external resources
                return caches.open(CACHE_NAME + '-external');
            })
            .then((externalCache) => {
                console.log('[SW] Caching external resources');
                return externalCache.addAll(EXTERNAL_CACHE_FILES.map(url => new Request(url, {
                    mode: 'cors',
                    credentials: 'omit'
                })));
            })
            .then(() => {
                console.log('[SW] Core files cached successfully');
                // Force activation of new service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache core files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== CACHE_NAME + '-external') {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Determine caching strategy based on request
    if (isNetworkFirstResource(request)) {
        event.respondWith(networkFirstStrategy(request));
    } else if (isImageResource(request)) {
        event.respondWith(cacheFirstStrategy(request));
    } else if (isExternalResource(request)) {
        event.respondWith(staleWhileRevalidateStrategy(request));
    } else {
        event.respondWith(cacheFirstStrategy(request));
    }
});

// Strategy: Network First (for API calls and dynamic content)
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page or error response
        return createOfflineResponse(request);
    }
}

// Strategy: Cache First (for static assets)
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Update cache in background for external resources
        if (isExternalResource(request)) {
            fetch(request).then(response => {
                if (response.status === 200) {
                    const cache = caches.open(CACHE_NAME + '-external');
                    cache.then(c => c.put(request, response));
                }
            }).catch(() => {
                // Ignore network errors for background updates
            });
        }
        
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.status === 200) {
            const cacheName = isExternalResource(request) ? 
                CACHE_NAME + '-external' : CACHE_NAME;
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Failed to fetch:', request.url);
        return createOfflineResponse(request);
    }
}

// Strategy: Stale While Revalidate (for fonts and external resources)
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME + '-external');
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in parallel
    const networkPromise = fetch(request).then(response => {
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => {
        // Return cached version on network error
        return cachedResponse;
    });
    
    // Return cached version immediately if available
    return cachedResponse || networkPromise;
}

// Helper functions
function isNetworkFirstResource(request) {
    return NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(request.url));
}

function isImageResource(request) {
    return IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(request.url)) ||
           request.destination === 'image';
}

function isExternalResource(request) {
    const url = new URL(request.url);
    return url.origin !== location.origin;
}

function createOfflineResponse(request) {
    if (request.destination === 'document') {
        return new Response(
            createOfflineHTML(),
            {
                headers: { 'Content-Type': 'text/html' },
                status: 200
            }
        );
    } else if (request.destination === 'image') {
        return new Response(
            createOfflineImageSVG(),
            {
                headers: { 'Content-Type': 'image/svg+xml' },
                status: 200
            }
        );
    } else {
        return new Response('Offline', { status: 503 });
    }
}

function createOfflineHTML() {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin Conexión - PC Service Pro</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                margin: 0; 
                background: #f8f9fa;
                color: #333;
                text-align: center;
                padding: 2rem;
            }
            .offline-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            h1 { color: #0d6efd; margin-bottom: 1rem; }
            p { margin-bottom: 1.5rem; max-width: 400px; }
            button {
                background: #0d6efd;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.375rem;
                cursor: pointer;
                font-size: 1rem;
            }
            button:hover { background: #0056b3; }
        </style>
    </head>
    <body>
        <div class="offline-icon">🔌</div>
        <h1>Sin Conexión a Internet</h1>
        <p>No se puede conectar a PC Service Pro en este momento. Verifica tu conexión a internet e inténtalo nuevamente.</p>
        <button onclick="window.location.reload()">Reintentar</button>
        
        <script>
            // Auto-reload when connection is restored
            window.addEventListener('online', function() {
                window.location.reload();
            });
        </script>
    </body>
    </html>`;
}

function createOfflineImageSVG() {
    return `
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <circle cx="150" cy="80" r="30" fill="#dee2e6"/>
        <path d="m120 120 60 60h60l-60-60z" fill="#dee2e6"/>
        <text x="50%" y="85%" font-family="Arial" font-size="14" fill="#6c757d" text-anchor="middle">
            Imagen no disponible sin conexión
        </text>
    </svg>`;
}

// Background sync for form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'contact-form-sync') {
        event.waitUntil(syncContactForms());
    }
});

async function syncContactForms() {
    try {
        // Get pending form submissions from IndexedDB
        const pendingForms = await getPendingFormSubmissions();
        
        for (const form of pendingForms) {
            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(form.data)
                });
                
                if (response.ok) {
                    await removePendingFormSubmission(form.id);
                    console.log('[SW] Form synced successfully:', form.id);
                }
            } catch (error) {
                console.log('[SW] Failed to sync form:', form.id, error);
            }
        }
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
    }
}

// Placeholder functions for IndexedDB operations
async function getPendingFormSubmissions() {
    // Implementation would use IndexedDB to store/retrieve pending forms
    return [];
}

async function removePendingFormSubmission(id) {
    // Implementation would remove the form from IndexedDB
    console.log('[SW] Would remove pending form:', id);
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nueva notificación de PC Service Pro',
            icon: '/assets/icon-192x192.png',
            badge: '/assets/icon-96x96.png',
            vibrate: [100, 50, 100],
            data: data.data || {},
            actions: data.actions || [],
            tag: data.tag || 'pc-service-notification',
            renotify: true
        };
        
        event.waitUntil(
            self.registration.showNotification(
                data.title || 'PC Service Pro',
                options
            )
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service Worker v' + CACHE_VERSION + ' loaded');