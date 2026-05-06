// ============================================================
// estadisticas.js - Modal de estadísticas de jugadores
// Gestiona la apertura del modal, la búsqueda de stats en vivo
// (NBA CDN) o históricas (BallDontLie), y su renderizado.
// ============================================================

/**
 * Abre el modal de estadísticas para un partido concreto.
 * Estrategia de búsqueda en cascada:
 *   1º → Intenta NBA CDN (stats en VIVO, actualizadas en tiempo real)
 *   2º → Si no hay en vivo, intenta BallDontLie (stats de partidos ya terminados)
 * 
 * @param {string} date    - Fecha del partido en formato YYYY-MM-DD
 * @param {string} team1   - Abreviatura ESPN del equipo local
 * @param {string} team2   - Abreviatura ESPN del equipo visitante
 * @param {string} team1Name - Nombre completo del equipo local
 * @param {string} team2Name - Nombre completo del equipo visitante
 */
function formatMinutes(value) {
    const str = String(value ?? '').trim();
    if (!str || str === '0') return '-';

    // MM:SS ya formateado
    if (str.includes(':')) return str;

    // Formato ISO 8601 de NBA CDN: PT14M06.000S, PT1H02M30.000S
    const isoMatch = str.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
    if (isoMatch) {
        const hours = parseInt(isoMatch[1] || 0, 10);
        const minutes = parseInt(isoMatch[2] || 0, 10) + hours * 60;
        const seconds = Math.round(parseFloat(isoMatch[3] || 0));
        if (minutes === 0 && seconds === 0) return '-';
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    // Número decimal: 14.1 → 14:06
    const num = parseFloat(str);
    if (!Number.isFinite(num) || num <= 0) return '-';
    const min = Math.floor(num);
    const sec = Math.round((num - min) * 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
}

async function openStatsModal(date, team1, team2, team1Name, team2Name) {
    const modal = document.getElementById('stats-modal');
    const modalHeader = document.getElementById('stats-modal-header');
    const modalBody = document.getElementById('stats-modal-body');
    
    // Muestra el modal inmediatamente con un spinner mientras carga
    modal.style.display = 'flex';
    modalHeader.innerHTML = `<h2>${team2Name} vs ${team1Name}</h2><p>Estadísticas de Jugadores</p>`;
    modalBody.innerHTML = '<div class="loading">Buscando estadísticas en vivo...</div>';
    
    try {
        // === PASO 1: Intentar obtener stats en vivo desde NBA CDN ===
        const nbaGameId = await findNBAGameId(team1, team2);
        
        if (nbaGameId) {
            console.log(`🏀 Encontrado NBA Game ID: ${nbaGameId}`);
            const liveStats = await fetchNBALiveStats(nbaGameId);
            
            if (liveStats) {
                renderNBALiveStats(liveStats);
                return; // Si hay stats en vivo, no necesitamos BallDontLie
            }
        }
        
        // === PASO 2: Fallback a BallDontLie (partidos ya terminados) ===
        console.log('📊 Intentando BallDontLie...');
        modalBody.innerHTML = '<div class="loading">Buscando estadísticas del partido...</div>';

        const searchResponse = await fetch(`${API_SERVER}/api/balldontlie/game?date=${date}&team1=${team1}&team2=${team2}`);

        if (searchResponse.status === 429) {
            modalBody.innerHTML = `
                <div class="stats-not-found">
                    <h3>⏳ Demasiadas peticiones</h3>
                    <p>Se han hecho muchas consultas seguidas. Espera unos segundos y vuelve a intentarlo.</p>
                </div>
            `;
            return;
        }

        const searchData = await searchResponse.json();
        
        // Si no se encontró el partido en BallDontLie
        if (!searchData.found) {
            modalBody.innerHTML = `
                <div class="stats-not-found">
                    <h3>📊 Stats no disponibles aún</h3>
                    <p>Las estadísticas de este partido todavía no están disponibles.</p>
                    <p>Esto puede pasar si:</p>
                    <ul>
                        <li>El partido aún no ha comenzado</li>
                        <li>El partido está en progreso pero los datos aún no están listos</li>
                        <li>El partido es muy reciente</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        const gameId = searchData.game.id;
        
        // Con el ID del partido, obtiene las stats individuales de cada jugador
        const statsResponse = await fetch(`${API_SERVER}/api/stats/${gameId}`);
        const statsData = await statsResponse.json();
        
        if (!statsData.data || statsData.data.length === 0) {
            modalBody.innerHTML = `
                <div class="stats-not-found">
                    <h3>📊 Sin estadísticas de jugadores</h3>
                    <p>No hay datos de jugadores disponibles para este partido.</p>
                </div>
            `;
            return;
        }
        
        // Renderiza las stats de BallDontLie
        renderPlayerStats(statsData.data, team1, team2, team1Name, team2Name);
        
    } catch (error) {
        console.error('Error cargando stats:', error);
        modalBody.innerHTML = `
            <div class="error-message">
                <h3>❌ Error al cargar estadísticas</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Busca el Game ID del partido en la CDN oficial de la NBA.
 * Necesitamos este ID para luego pedir el boxscore (stats detalladas).
 * Convierte las abreviaturas de ESPN a formato NBA CDN antes de buscar.
 * 
 * @param {string} team1 - Abreviatura ESPN del equipo 1
 * @param {string} team2 - Abreviatura ESPN del equipo 2
 * @returns {string|null} El gameId de NBA CDN, o null si no se encontró
 */
async function findNBAGameId(team1, team2) {
    try {
        const response = await fetch(`${API_SERVER}/api/nba/scoreboard`);
        if (!response.ok) return null;
        
        const data = await response.json();
        // El operador ?. (optional chaining) evita errores si 'scoreboard' es undefined
        const games = data.scoreboard?.games || [];
        
        // Convierte las abreviaturas de ESPN al formato que usa la NBA CDN
        const nbaTeam1 = toNbaAbbr(team1);
        const nbaTeam2 = toNbaAbbr(team2);
        
        console.log(`🔍 Buscando partido: ${team1}(${nbaTeam1}) vs ${team2}(${nbaTeam2})`);
        
        // .find() busca el primer partido donde los equipos coincidan (en cualquier orden)
        const game = games.find(g => {
            const home = g.homeTeam.teamTricode;
            const away = g.awayTeam.teamTricode;
            return (home === nbaTeam1 && away === nbaTeam2) || (home === nbaTeam2 && away === nbaTeam1);
        });
        
        if (game) {
            console.log(`✅ Encontrado: ${game.gameId} - ${game.gameStatusText}`);
        } else {
            console.log(`❌ No encontrado en NBA CDN`);
        }
        
        // Devuelve el ID si se encontró, o null si no
        return game ? game.gameId : null;
    } catch (error) {
        console.error('Error buscando NBA Game ID:', error);
        return null;
    }
}

/**
 * Obtiene las estadísticas detalladas (boxscore) de un partido en vivo
 * desde la CDN oficial de la NBA.
 * 
 * @param {string} gameId - El ID del partido en NBA CDN
 * @returns {Object|null} Objeto con datos del partido, o null si falló
 */
async function fetchNBALiveStats(gameId) {
    try {
        const response = await fetch(`${API_SERVER}/api/nba/boxscore/${gameId}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        return data.game || null;
    } catch (error) {
        console.error('Error obteniendo boxscore NBA:', error);
        return null;
    }
}

/**
 * Renderiza en el modal las estadísticas en vivo obtenidas de NBA CDN.
 * Muestra una tabla para cada equipo con: nombre, minutos, puntos,
 * rebotes, asistencias, robos, tapones, tiros de campo, triples y +/-.
 * Los jugadores que están en cancha se marcan con un icono 🏃.
 * 
 * @param {Object} game - Objeto del partido con homeTeam y awayTeam (de NBA CDN)
 */
function renderNBALiveStats(game) {
    const modalBody = document.getElementById('stats-modal-body');
    const modalHeader = document.getElementById('stats-modal-header');
    
    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    
    // Actualiza el header del modal con el marcador actual y estado del partido
    const statusText = game.gameStatusText || '';
    modalHeader.innerHTML = `
        <h2>${awayTeam.teamCity} ${awayTeam.teamName} <span class="live-score">${awayTeam.score}</span> - <span class="live-score">${homeTeam.score}</span> ${homeTeam.teamCity} ${homeTeam.teamName}</h2>
        <p class="live-status"><span class="live-indicator"></span> ${statusText} - Stats en vivo</p>
    `;
    
    modalBody.innerHTML = `
        <div class="stats-teams">
            <div class="stats-team">
                <h3>${awayTeam.teamCity} ${awayTeam.teamName}</h3>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>MIN</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                            <th>FG</th>
                            <th>3PT</th>
                            <th>+/-</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(awayTeam.players || [])
                            // Filtra solo jugadores que tienen estadísticas registradas
                            .filter(p => p.statistics)
                            .map(p => {
                            const s = p.statistics;
                            return `
                                <tr class="${p.oncourt === '1' ? 'on-court' : ''}">
                                    <td class="player-name">${p.name}${p.oncourt === '1' ? ' 🏃' : ''}</td>
                                    <td>${formatMinutes(s.minutes)}</td>
                                    <td class="highlight">${s.points}</td>
                                    <td>${s.reboundsTotal}</td>
                                    <td>${s.assists}</td>
                                    <td>${s.steals}</td>
                                    <td>${s.blocks}</td>
                                    <td>${s.fieldGoalsMade}/${s.fieldGoalsAttempted}</td>
                                    <td>${s.threePointersMade}/${s.threePointersAttempted}</td>
                                    <!-- Aplica clase 'positive' o 'negative' según el signo del +/- -->
                                    <td class="${parseInt(s.plusMinusPoints) > 0 ? 'positive' : parseInt(s.plusMinusPoints) < 0 ? 'negative' : ''}">${s.plusMinusPoints}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="stats-team">
                <h3>${homeTeam.teamCity} ${homeTeam.teamName}</h3>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>MIN</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                            <th>FG</th>
                            <th>3PT</th>
                            <th>+/-</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(homeTeam.players || [])
                            .filter(p => p.statistics)
                            .map(p => {
                            const s = p.statistics;
                            return `
                                <tr class="${p.oncourt === '1' ? 'on-court' : ''}">
                                    <td class="player-name">${p.name}${p.oncourt === '1' ? ' 🏃' : ''}</td>
                                    <td>${formatMinutes(s.minutes)}</td>
                                    <td class="highlight">${s.points}</td>
                                    <td>${s.reboundsTotal}</td>
                                    <td>${s.assists}</td>
                                    <td>${s.steals}</td>
                                    <td>${s.blocks}</td>
                                    <td>${s.fieldGoalsMade}/${s.fieldGoalsAttempted}</td>
                                    <td>${s.threePointersMade}/${s.threePointersAttempted}</td>
                                    <td class="${parseInt(s.plusMinusPoints) > 0 ? 'positive' : parseInt(s.plusMinusPoints) < 0 ? 'negative' : ''}">${s.plusMinusPoints}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="refresh-hint">Las stats se actualizan automáticamente desde NBA.com</div>
    `;
}

/**
 * Renderiza en el modal las estadísticas de jugadores obtenidas de BallDontLie.
 * Esta función se usa como fallback cuando no hay stats en vivo de NBA CDN
 * (normalmente para partidos ya finalizados).
 * 
 * @param {Array}  stats     - Array de objetos con stats de cada jugador
 * @param {string} team1Abbr - Abreviatura del equipo local
 * @param {string} team2Abbr - Abreviatura del equipo visitante
 * @param {string} team1Name - Nombre completo del equipo local
 * @param {string} team2Name - Nombre completo del equipo visitante
 */
function renderPlayerStats(stats, team1Abbr, team2Abbr, team1Name, team2Name) {
    const modalBody = document.getElementById('stats-modal-body');
    
    // Separa los jugadores por equipo usando la abreviatura
    const team1Stats = stats.filter(s => s.team.abbreviation === team1Abbr);
    const team2Stats = stats.filter(s => s.team.abbreviation === team2Abbr);
    
    let homeStats, awayStats;

    // Si las abreviaturas de ESPN no coinciden con las de BallDontLie,
    // agrupa por team.id como plan B (extrae IDs únicos con Set)
    if (team1Stats.length === 0 && team2Stats.length === 0) {
        // [...new Set(...)] crea un array de valores únicos de team.id
        const teamIds = [...new Set(stats.map(s => s.team.id))];
        homeStats = stats.filter(s => s.team.id === teamIds[0]);
        awayStats = stats.filter(s => s.team.id === teamIds[1]);
    } else {
        homeStats = team1Stats;
        awayStats = team2Stats;
    }
    
    modalBody.innerHTML = `
        <div class="stats-teams">
            <div class="stats-team">
                <!-- El operador ?. evita error si awayStats[0] es undefined -->
                <h3>${awayStats[0]?.team.full_name || team2Name}</h3>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>MIN</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                            <th>FG</th>
                            <th>3PT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${awayStats.map(s => `
                            <tr>
                                <td class="player-name">${s.player.first_name} ${s.player.last_name}</td>
                                <td>${formatMinutes(s.min)}</td>
                                <td class="highlight">${s.pts}</td>
                                <td>${s.reb}</td>
                                <td>${s.ast}</td>
                                <td>${s.stl}</td>
                                <td>${s.blk}</td>
                                <td>${s.fgm}/${s.fga}</td>
                                <td>${s.fg3m}/${s.fg3a}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="stats-team">
                <h3>${homeStats[0]?.team.full_name || team1Name}</h3>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>MIN</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                            <th>FG</th>
                            <th>3PT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${homeStats.map(s => `
                            <tr>
                                <td class="player-name">${s.player.first_name} ${s.player.last_name}</td>
                                <td>${formatMinutes(s.min)}</td>
                                <td class="highlight">${s.pts}</td>
                                <td>${s.reb}</td>
                                <td>${s.ast}</td>
                                <td>${s.stl}</td>
                                <td>${s.blk}</td>
                                <td>${s.fgm}/${s.fga}</td>
                                <td>${s.fg3m}/${s.fg3a}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Cierra el modal de estadísticas ocultándolo.
 */
function closeStatsModal() {
    document.getElementById('stats-modal').style.display = 'none';
}

// Cierra el modal si el usuario hace click FUERA del contenido del modal
// (es decir, en el fondo oscuro semitransparente)
window.onclick = function(event) {
    const modal = document.getElementById('stats-modal');
    // event.target === modal significa que se hizo click en el fondo, no en el contenido
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}
