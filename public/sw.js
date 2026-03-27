const CACHE_NAME = 'coalition-ai-v3';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/images/logo.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    // Force new service worker to activate immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// Fetch event - handle SPA navigation
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // API requests should always go to network
    if (event.request.url.includes('/api/')) {
        return;
    }

    // Handle Navigation Requests (SPA Support)
    // If it's a navigation request (user visiting a page), return index.html
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Check if we received a valid response
                    if (!response || response.status === 404) {
                        return caches.match('/index.html');
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // Stale-while-revalidate strategy for other assets
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    // Claim clients immediately so the new SW controls the page
    event.waitUntil(clients.claim());

    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
