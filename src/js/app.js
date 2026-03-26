const API_KEY = 'f72a43d7';
const API_URL = 'http://www.omdbapi.com/';

let isOnline = navigator.onLine;
let currentMovies = [];

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const moviesGrid = document.getElementById('moviesGrid');
const readLaterGrid = document.getElementById('readLaterGrid');
const loadingDiv = document.getElementById('loadingDiv');
const errorDiv = document.getElementById('errorDiv');
const errorMessage = document.getElementById('errorMessage');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const swStatus = document.getElementById('swStatus');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 CineCache iniciando...');

    registerServiceWorker();

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleSearch();
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updateConnectionStatus();
    loadReadLater();

    console.log('✅ App inicializado');
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(function(registration) {
                console.log('✅ Service Worker registrado');
                swStatus.textContent = '✅ Activo';
            })
            .catch(function(error) {
                console.error('❌ Error registrando SW:', error);
                swStatus.textContent = '❌ Error';
            });
    }
}

function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        showError('Por favor ingresa el nombre de una película');
        return;
    }

    showLoading(true);
    clearError();

    searchMovies(query)
        .then(function(results) {
            if (!results || results.length === 0) {
                showError('No se encontraron películas');
                showLoading(false);
                return;
            }

            currentMovies = results;
            displayMovies(results);
            console.log('✅ ' + results.length + ' películas encontradas');
            showLoading(false);
        })
        .catch(function(error) {
            console.error('Error:', error);
            
            // Si está offline, intenta obtener del histórico de búsquedas
            if (!isOnline) {
                const cachedSearch = getCachedSearch(query);
                if (cachedSearch) {
                    console.log('📦 Obtenidas del caché offline:', cachedSearch.length);
                    currentMovies = cachedSearch;
                    displayMovies(cachedSearch);
                    showError('📦 Resultados del caché (sin conexión)');
                    showLoading(false);
                    return;
                }
                
                // Si no está en caché, mostrar página offline
                console.log('❌ Búsqueda no en caché y sin conexión, mostrando offline.html');
                showOfflinePage();
                showLoading(false);
                return;
            }
            
            showError('Error: ' + error.message);
            showLoading(false);
        });
}

function searchMovies(query) {
    return new Promise(function(resolve, reject) {
        const url = API_URL + '?apikey=' + API_KEY + '&s=' + encodeURIComponent(query) + '&type=movie';

        fetch(url)
            .then(function(response) {
                if (!response.ok) {
                    // Intentar parsear el error como JSON (ej: respuesta del Service Worker)
                    return response.json()
                        .then(function(data) {
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            throw new Error('HTTP ' + response.status);
                        })
                        .catch(function() {
                            throw new Error('HTTP ' + response.status);
                        });
                }
                return response.json();
            })
            .then(function(data) {
                if (data.Error) {
                    throw new Error(data.Error);
                }

                if (!data.Search || data.Search.length === 0) {
                    resolve([]);
                    return;
                }

                const promises = data.Search.slice(0, 10).map(function(m) {
                    return getMovieDetails(m.imdbID);
                });

                Promise.all(promises)
                    .then(function(movies) {
                        const results = movies.filter(function(m) { return m !== null; });
                        // Guardar búsqueda exitosa en caché
                        cacheSearch(query, results);
                        resolve(results);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
            })
            .catch(function(error) {
                console.error('Error buscando:', error);
                reject(error);
            });
    });
}

function getMovieDetails(imdbID) {
    return new Promise(function(resolve) {
        const url = API_URL + '?apikey=' + API_KEY + '&i=' + imdbID + '&plot=full';

        fetch(url)
            .then(function(response) {
                if (!response.ok) {
                    resolve(null);
                    return;
                }
                return response.json();
            })
            .then(function(data) {
                resolve(data && !data.Error ? data : null);
            })
            .catch(function() {
                resolve(null);
            });
    });
}

function displayMovies(movies) {
    moviesGrid.innerHTML = '';

    movies.forEach(function(movie) {
        const card = createMovieCard(movie);
        moviesGrid.appendChild(card);
    });
}

function createMovieCard(movie) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded border border-gray-300 overflow-hidden shadow-sm hover:shadow-md transition-shadow';

    const poster = movie.Poster && movie.Poster !== 'N/A'
        ? movie.Poster
        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><rect fill="%23e5e7eb" width="300" height="450"/><text x="50%" y="50%" font-size="14" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle">Sin imagen</text></svg>';

    div.innerHTML = '<img src="' + poster + '" alt="' + movie.Title + '" class="w-full h-48 object-cover bg-gray-200">'
        + '<div class="p-2">'
        + '<h3 class="font-bold text-sm text-gray-900 truncate">' + movie.Title + '</h3>'
        + '<p class="text-xs text-gray-600">' + movie.Year + '</p>'
        + '<p class="text-xs text-gray-600">⭐ ' + (movie.imdbRating || 'N/A') + '</p>'
        + '<div class="mt-2 space-y-1">'
        + '<button class="w-full bg-blue-900 hover:bg-blue-800 text-white text-xs py-1 rounded font-bold transition-colors" onclick="addReadLater(\'' + movie.imdbID + '\', \'' + movie.Title.replace(/'/g, "\\'") + '\', \'' + (movie.Poster || '').replace(/'/g, "\\'") + '\')">'
        + '📌 Leer Después'
        + '</button>'
        + '</div>'
        + '</div>';

    return div;
}

function addReadLater(imdbID, title, poster) {
    const readLater = JSON.parse(localStorage.getItem('readLater') || '[]');

    if (readLater.find(function(m) { return m.imdbID === imdbID; })) {
        alert('❌ Ya está en tu lista');
        return;
    }

    readLater.push({ imdbID: imdbID, title: title, poster: poster, addedAt: new Date().toISOString() });
    localStorage.setItem('readLater', JSON.stringify(readLater));

    console.log('💾 Guardado para leer después: ' + title);
    alert('✅ Guardado en "Leer Después"');

    loadReadLater();
}

function loadReadLater() {
    const readLater = JSON.parse(localStorage.getItem('readLater') || '[]');
    readLaterGrid.innerHTML = '';

    if (readLater.length === 0) {
        readLaterGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-600 text-sm">Aún no hay películas guardadas</div>';
        return;
    }

    readLater.forEach(function(movie) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded border border-gray-300 overflow-hidden shadow-sm';

        const posterImg = movie.poster || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"><rect fill="%23e5e7eb" width="300" height="450"/></svg>';

        div.innerHTML = '<img src="' + posterImg + '" alt="' + movie.title + '" class="w-full h-48 object-cover bg-gray-200">'
            + '<div class="p-2">'
            + '<h3 class="font-bold text-sm text-gray-900 truncate">' + movie.title + '</h3>'
            + '<p class="text-xs text-gray-500">' + new Date(movie.addedAt).toLocaleDateString() + '</p>'
            + '<button class="mt-2 w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1 rounded font-bold transition-colors" onclick="removeReadLater(\'' + movie.imdbID + '\')">'
            + '🗑️ Eliminar'
            + '</button>'
            + '</div>';

        readLaterGrid.appendChild(div);
    });
}

function removeReadLater(imdbID) {
    let readLater = JSON.parse(localStorage.getItem('readLater') || '[]');
    readLater = readLater.filter(function(m) { return m.imdbID !== imdbID; });
    localStorage.setItem('readLater', JSON.stringify(readLater));

    console.log('🗑️ Eliminado de leer después: ' + imdbID);
    loadReadLater();
}

function cacheSearch(query, results) {
    const searchCache = JSON.parse(localStorage.getItem('searchCache') || '{}');
    searchCache[query.toLowerCase()] = {
        results: results,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('searchCache', JSON.stringify(searchCache));
    console.log('💾 Búsqueda cacheada:', query);
}

function getCachedSearch(query) {
    const searchCache = JSON.parse(localStorage.getItem('searchCache') || '{}');
    const cached = searchCache[query.toLowerCase()];
    if (cached && cached.results) {
        console.log('📦 Búsqueda encontrada en caché:', query);
        return cached.results;
    }
    return null;
}

function showOfflinePage() {
    const offlineHTML = `
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center max-w-md">
                <div class="text-6xl mb-4">📵</div>
                <h1 class="text-3xl font-bold mb-2 text-gray-900">Sin Conexión</h1>
                <p class="text-gray-600 mb-4">No hay conexión a internet disponible</p>

                <div class="bg-gray-100 border-2 border-gray-300 rounded p-4 mb-4">
                    <p class="text-sm text-gray-700">
                        ✅ Puedes ver películas que ya guardaste en "Leer Después"
                    </p>
                </div>

                <button onclick="location.href = './';" class="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded transition-colors">
                    ← Volver
                </button>

                <div class="bg-gray-100 rounded p-4 mt-4 border border-gray-300">
                    <h3 class="font-bold text-gray-900 mb-2">💡 Estrategias de Caching:</h3>
                    <ul class="text-xs text-gray-700 text-left space-y-1">
                        <li>🔵 <strong>Cache First:</strong> App Shell</li>
                        <li>🟢 <strong>Network First:</strong> API</li>
                        <li>🟡 <strong>SWR:</strong> Imágenes</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    // Reemplazar el contenido principal
    document.querySelector('main').innerHTML = offlineHTML;
    console.log('✅ Página offline mostrada');
}

function handleOnline() {
    isOnline = true;
    updateConnectionStatus();
    console.log('🟢 Online');
}

function handleOffline() {
    isOnline = false;
    updateConnectionStatus();
    console.log('🔴 Offline');
}

function updateConnectionStatus() {
    if (isOnline) {
        statusIndicator.className = 'w-2 h-2 rounded-full bg-green-500';
        statusText.textContent = '🟢 Conectado';
    } else {
        statusIndicator.className = 'w-2 h-2 rounded-full bg-red-500';
        statusText.textContent = '🔴 Sin Conexión';
    }
}

function showLoading(show) {
    loadingDiv.classList.toggle('hidden', !show);
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorDiv.classList.remove('hidden');
}

function clearError() {
    errorDiv.classList.add('hidden');
}

console.log('📟 App.js cargado');
