// ============================================================
// script.js - Punto de entrada principal de la aplicación
// 
// Este archivo NO contiene lógica de negocio. Solo se encarga de:
//   1. Arrancar la aplicación llamando a las funciones de carga iniciales
//   2. Configurar los intervalos de auto-actualización
//
// Los módulos que se cargan ANTES de este script son:
//   - config.js        → Configuración global (API_SERVER, mapa de equipos)
//   - partidos.js      → Carga y renderizado de partidos en vivo
//   - estadisticas.js  → Modal de stats de jugadores (NBA CDN + BallDontLie)
//   - noticias.js      → Noticias de ESPN
//   - clasificacion.js → Standings / Clasificación de conferencias
//   - utilidades.js    → Funciones auxiliares (scroll suave, etc.)
// ============================================================

function hasElement(id) {
    return Boolean(document.getElementById(id));
}

function bootPageModules() {
    // ---- Carga inicial según página ----
    if (hasElement('games-container') && typeof loadGames === 'function') {
        loadGames();

        // Refresca marcadores cada 15 segundos solo si estamos en la página de Games.
        setInterval(() => {
            loadGames();
        }, 15000);
    }

    if (hasElement('news-container') && typeof loadNews === 'function') {
        loadNews();
    }

    if (hasElement('east-standings') && hasElement('west-standings') && typeof loadStandings === 'function') {
        loadStandings();
    }

    if (hasElement('favorite-teams-list') && typeof initFavorites === 'function') {
        initFavorites();
    }

    if (hasElement('trivia-question') && typeof initMiniGames === 'function') {
        initMiniGames();
    }

    if (hasElement('stats-teams-grid') && typeof initTeamStatsPage === 'function') {
        initTeamStatsPage();
    }

    if (hasElement('playoffs-content') && typeof loadPlayoffs === 'function') {
        loadPlayoffs();
    }

    if ((hasElement('contactForm') || hasElement('reviewForm') || hasElement('reviews-list')) && typeof initHomeCommunity === 'function') {
        initHomeCommunity();
    }
}

function initApp() {
    if (typeof initAuth === 'function') {
        const isReady = initAuth();
        if (!isReady) return;
    }

    bootPageModules();
}

initApp();
