// ============================================================
// utilidades.js - Funciones auxiliares y utilidades generales
// Contiene funciones que no pertenecen a ningún módulo específico,
// como el scroll suave al chatbot.
// ============================================================

/**
 * Hace scroll suave hasta la sección de Games (#games)
 * y recarga los partidos para asegurar que se muestran datos frescos.
 * Esta función se llama desde el chatbot Landbot cuando el usuario
 * pide ver los marcadores.
 */
function scrollToScores() {
    // Mantiene compatibilidad con id antiguo (#scores) por si algún flujo externo lo usa.
    const gamesSection = document.getElementById('games') || document.getElementById('scores');

    if (gamesSection) {
        // scrollIntoView con behavior 'smooth' anima el desplazamiento en vez de saltar
        gamesSection.scrollIntoView({behavior: 'smooth'});
    } else {
        // Si estamos en otra pagina, navega a la pagina dedicada de Games.
        window.location.href = 'games.html';
        return;
    }
    
    // typeof comprueba que loadGames existe antes de llamarla,
    // por seguridad en caso de que partidos.js no se haya cargado
    if(typeof loadGames === 'function') { loadGames(); }
}
