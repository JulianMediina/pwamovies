/**
 * Ejemplo de archivo JS adicional
 * Archivos en src/js/ sirven para funcionalidades extendidas
 */

// Ejemplo: Funciones auxiliares para debbugin de caches

window.debugCaches = async function() {
    console.log('🔍 === Analizando Caches ===');

    const cacheNames = await caches.keys();
    console.log('📋 Caches disponibles:', cacheNames);

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        console.log(`\n📦 Cache: ${cacheName} (${keys.length} items)`);
        keys.forEach(req => {
            console.log(`   - ${req.url}`);
        });
    }
};

window.clearAllCaches = async function() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('✅ Todos los caches han sido eliminados');
};

console.log('💡 Comandos disponibles en consola:');
console.log('   - debugCaches() : Ver información de caches');
console.log('   - clearAllCaches() : Limpiar todos los caches');
