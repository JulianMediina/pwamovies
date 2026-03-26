const CACHE_NAME = {
    APP_SHELL: 'app-shell-v1',
    API: 'api-cache-v1',
    IMAGES: 'images-cache-v1'
};

const PRECACHE_URLS = [
    '/',
    './index.html',
    './app.js',
    './offline.html',
    './src/pages/offline.html'
];

console.log('📟 Service Worker: Constantes definidas');

self.addEventListener('install', function(event) {
    console.log('🔧 Service Worker: install event');

    event.waitUntil(
        caches.open(CACHE_NAME.APP_SHELL)
            .then(function(cache) {
                console.log('📦 Precacheando App Shell...');
                return cache.addAll(PRECACHE_URLS)
                    .then(function() {
                        console.log('✅ Precache completado');
                        return self.skipWaiting();
                    })
                    .catch(function(err) {
                        console.warn('⚠️ Error en precaching:', err);
                        return self.skipWaiting();
                    });
            })
            .catch(function(error) {
                console.error('❌ Error en install:', error);
            })
    );
});

self.addEventListener('activate', function(event) {
    console.log('🚀 Service Worker: activate event');

    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) {
                            return !Object.values(CACHE_NAME).includes(name);
                        })
                        .map(function(name) {
                            console.log('🗑️ Eliminando caché antiguo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', function(event) {
    const request = event.request;
    const url = new URL(request.url);

    if (!url.protocol.startsWith('http')) {
        return;
    }

    if (isAppShell(request, url)) {
        console.log('🔵 [CACHE FIRST] App Shell:', url.pathname);
        event.respondWith(cacheFirst(request));
    }
    else if (isAPI(url)) {
        console.log('🟢 [NETWORK FIRST] API:', url.hostname);
        event.respondWith(networkFirst(request));
    }
    else if (isImage(request)) {
        console.log('🟡 [SWR] Imagen:', url.pathname);
        event.respondWith(staleWhileRevalidate(request));
    }
    else {
        event.respondWith(
            fetch(request)
                .catch(function() {
                    return caches.match('./index.html');
                })
        );
    }
});

function isAppShell(request, url) {
    if (request.destination === 'document') return true;
    if (url.pathname.endsWith('.html')) return true;
    if (url.pathname.endsWith('.js')) return true;
    if (url.pathname === '/' || url.pathname === '') return true;
    return false;
}

function isAPI(url) {
    return url.hostname.includes('omdbapi.com');
}

function isImage(request) {
    return request.destination === 'image';
}

function cacheFirst(request) {
    return caches.match(request)
        .then(function(cached) {
            if (cached) {
                console.log('  ✅ Desde CACHÉ:', request.url);
                return cached;
            }

            return fetch(request)
                .then(function(response) {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME.APP_SHELL)
                            .then(function(cache) {
                                cache.put(request, responseClone);
                                console.log('  ✅ Guardado en caché:', request.url);
                            });
                    }
                    return response;
                })
                .catch(function() {
                    return caches.match('./offline.html')
                        .then(function(offlineResponse) {
                            return offlineResponse || new Response('Sin conexión', { status: 503 });
                        });
                });
        });
}

function networkFirst(request) {
    return fetch(request)
        .then(function(response) {
            if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME.API)
                    .then(function(cache) {
                        cache.put(request, responseClone);
                        console.log('  ✅ Desde RED (guardado en caché):', request.url);
                    });
            }
            return response;
        })
        .catch(function() {
            console.log('  ⚠️ RED falló, buscando en caché:', request.url);

            return caches.match(request)
                .then(function(cached) {
                    if (cached) {
                        console.log('  ✅ Desde CACHÉ (offline)');
                        return cached;
                    }

                    return new Response(
                        JSON.stringify({ error: 'Sin conexión. Intenta una búsqueda anterior.' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    );
                });
        });
}

function staleWhileRevalidate(request) {
    return caches.match(request)
        .then(function(cached) {
            if (cached) {
                console.log('  ✅ Imagen desde CACHÉ (SWR)');

                fetch(request)
                    .then(function(response) {
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME.IMAGES)
                                .then(function(cache) {
                                    cache.put(request, responseClone);
                                    console.log('  🔄 Imagen actualizada en bg');
                                });
                        }
                    })
                    .catch(function() {
                        console.log('  ℹ️ No se pudo actualizar imagen en bg');
                    });

                return cached;
            }

            return fetch(request)
                .then(function(response) {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME.IMAGES)
                            .then(function(cache) {
                                cache.put(request, responseClone);
                                console.log('  ✅ Imagen desde RED (guardada en caché)');
                            });
                    }
                    return response;
                })
                .catch(function() {
                    return new Response('', { status: 404 });
                });
        });
}

console.log('📟 Service Worker: Todas las estrategias cargadas');
