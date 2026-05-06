// ============================================================
// partidos.js - Carga y renderizado de los partidos en vivo
// Se encarga de obtener los marcadores de ESPN y pintarlos
// como tarjetas (game-cards) en la sección de Scores.
// ============================================================

// Throttle del botón ACTUALIZAR: evita llamadas si la caché del servidor
// (10s ESPN) aún no ha expirado. El auto-refresh (15s) nunca se bloquea.
let _lastManualRefresh = 0;
const _MANUAL_REFRESH_COOLDOWN = 10000; // 10 segundos

/**
 * Carga los partidos en vivo desde ESPN a través de nuestro servidor proxy.
 * @param {boolean} isManual - true si viene del botón ACTUALIZAR, false si es auto-refresh
 */
async function loadGames(isManual = false) {
    const gamesContainer = document.getElementById('games-container');
    if (!gamesContainer) return;

    // Si es un refresh manual, aplicar throttle y feedback visual en el botón
    if (isManual) {
        const now = Date.now();
        const remaining = _MANUAL_REFRESH_COOLDOWN - (now - _lastManualRefresh);
        if (remaining > 0) {
            const btn = document.querySelector('.view-all');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = `Espera ${Math.ceil(remaining / 1000)}s...`;
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
                setTimeout(() => {
                    btn.textContent = orig;
                    btn.style.opacity = '';
                    btn.style.pointerEvents = '';
                }, remaining);
            }
            return;
        }
        _lastManualRefresh = now;

        // Deshabilitar el botón durante la carga
        const btn = document.querySelector('.view-all');
        if (btn) {
            btn.textContent = 'Actualizando...';
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            setTimeout(() => {
                btn.textContent = 'Actualizar ↻';
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }, _MANUAL_REFRESH_COOLDOWN);
        }
    }

    // Solo muestra "Cargando..." si aún no hay tarjetas (evita parpadeo en auto-refresh)
    if (!gamesContainer.querySelector('.game-card') && !gamesContainer.querySelector('.error-message')) {
        gamesContainer.innerHTML = '<div class="loading">Cargando partidos en vivo...</div>';
    }

    try {
        const response = await fetch(`${API_SERVER}/api/espn/scoreboard`);

        // 429: demasiadas peticiones — mantener contenido actual y avisar suavemente
        if (response.status === 429) {
            console.warn('Rate limit alcanzado en loadGames, reintentando en 15s');
            if (!gamesContainer.querySelector('.game-card')) {
                gamesContainer.innerHTML = `
                    <div class="error-message">
                        <h3>⏳ Actualizando datos...</h3>
                        <p>Demasiadas peticiones seguidas. Los partidos se recargarán automáticamente en unos segundos.</p>
                    </div>
                `;
            }
            return;
        }

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const events = data.events;

        if (!events || events.length === 0) {
            gamesContainer.innerHTML = `
                <div class="error-message">
                    <h3>📅 No hay partidos programados para hoy</h3>
                    <p>Vuelve más tarde cuando haya partidos</p>
                </div>
            `;
            return;
        }

        renderESPNGames(events);

    } catch (error) {
        console.error('Error:', error);
        // Solo mostrar el error si no hay contenido previo que conservar
        if (!gamesContainer.querySelector('.game-card')) {
            gamesContainer.innerHTML = `
                <div class="error-message">
                    <h3>❌ Error al cargar los partidos</h3>
                    <p>${error.message}</p>
                    <p style="margin-top: 15px; color: #666;">Verifica que el servidor esté corriendo</p>
                </div>
            `;
        }
    }
}

/**
 * Renderiza las tarjetas de partidos en el DOM a partir de los datos de ESPN.
 * Cada tarjeta muestra: equipos, logos, marcador, estado (en vivo / final / programado),
 * y es clickeable para abrir el modal de estadísticas de jugadores.
 * 
 * @param {Array} events - Array de eventos/partidos de la API ESPN scoreboard
 */
function renderESPNGames(events) {
    const gamesContainer = document.getElementById('games-container');
    if (!gamesContainer) return;
    
    if (!events || events.length === 0) {
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>🏀 No hay partidos disponibles</h3>
                <p>Intenta de nuevo más tarde</p>
            </div>
        `;
        return;
    }

    // .map() transforma cada evento en una cadena HTML, y .join('') las une
    gamesContainer.innerHTML = events.map(event => {
        const competition = event.competitions[0]; // Un evento solo tiene 1 competición

        // Identifica al equipo local (home) y visitante (away) buscando en los competidores
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const homeScore = homeTeam.score || '0';
        const awayScore = awayTeam.score || '0';
        
        // --- Estado del partido ---
        const status = event.status;
        // statusType puede ser: STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL, STATUS_HALFTIME
        const statusType = status.type.name;
        const clock = status.displayClock || '';   // Reloj del partido (ej: "5:32")
        const period = status.period || 0;          // Cuarto actual (1-4, >4 = prórrogas)
        
        let statusHTML = '';
        let isLive = false;
        let timeDisplay = '';
        
        if (statusType === 'STATUS_FINAL') {
            statusHTML = '<div class="game-status final">FINAL</div>';
        } else if (statusType === 'STATUS_IN_PROGRESS') {
            isLive = true;
            // Si el periodo es <=4 es un cuarto normal (Q1-Q4), si no es prórroga (OT1, OT2...)
            const periodText = period <= 4 ? `Q${period}` : `OT${period - 4}`;
            timeDisplay = `${clock} - ${periodText}`;
            statusHTML = `<div class="game-status live"><span class="live-indicator"></span>EN VIVO - ${timeDisplay}</div>`;
        } else if (statusType === 'STATUS_HALFTIME') {
            isLive = true;
            statusHTML = '<div class="game-status live"><span class="live-indicator"></span>DESCANSO</div>';
        } else {
            // Partido programado: muestra la hora local
            const gameDate = new Date(event.date);
            const dateStr = gameDate.toLocaleTimeString('es-ES', { 
                hour: '2-digit',
                minute: '2-digit'
            });
            statusHTML = `<div class="game-status scheduled">${dateStr}</div>`;
        }

        // Extrae fecha en formato YYYY-MM-DD para buscar stats después
        const gameDate = new Date(event.date).toISOString().split('T')[0];
        const homeAbbr = homeTeam.team.abbreviation;
        const awayAbbr = awayTeam.team.abbreviation;

        // URLs de los logos de los equipos (proporcionados por ESPN)
        const homeLogo = homeTeam.team.logo || '';
        const awayLogo = awayTeam.team.logo || '';

        // Construye el HTML de la tarjeta del partido
        // onclick llama a openStatsModal() (definida en estadisticas.js) para abrir el modal
        return `
            <div class="game-card ${isLive ? 'live' : ''}" 
                 onclick="openStatsModal('${gameDate}', '${homeAbbr}', '${awayAbbr}', '${homeTeam.team.displayName}', '${awayTeam.team.displayName}')"
                 data-game-date="${gameDate}"
                 data-home-team="${homeAbbr}"
                 data-away-team="${awayAbbr}">
                ${statusHTML}
                <div class="teams-container">
                    <div class="team away">
                        ${awayLogo ? `<img src="${awayLogo}" alt="${awayTeam.team.displayName}" class="team-logo-img">` : `<div class="team-logo">${awayAbbr}</div>`}
                        <div class="team-info">
                            <span class="team-name">${awayTeam.team.displayName}</span>
                            <span class="team-record">${awayTeam.records ? awayTeam.records[0].summary : ''}</span>
                        </div>
                        <span class="score ${parseInt(awayScore) > parseInt(homeScore) ? 'winning' : ''}">${awayScore}</span>
                    </div>
                    <div class="team home">
                        ${homeLogo ? `<img src="${homeLogo}" alt="${homeTeam.team.displayName}" class="team-logo-img">` : `<div class="team-logo">${homeAbbr}</div>`}
                        <div class="team-info">
                            <span class="team-name">${homeTeam.team.displayName}</span>
                            <span class="team-record">${homeTeam.records ? homeTeam.records[0].summary : ''}</span>
                        </div>
                        <span class="score ${parseInt(homeScore) > parseInt(awayScore) ? 'winning' : ''}">${homeScore}</span>
                    </div>
                </div>
                <div class="click-hint">Click para ver stats de jugadores</div>
            </div>
        `;
    }).join('');
}
