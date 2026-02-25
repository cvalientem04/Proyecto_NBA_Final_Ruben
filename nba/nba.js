// URL del servidor (cambia a tu dominio en producción)
const API_SERVER = 'http://localhost:3000';

// ============ MARCADORES EN VIVO (ESPN) ============

// Cargar partidos de ESPN (tiempo real)
async function loadGames() {
    const gamesContainer = document.getElementById('games-container');
    gamesContainer.innerHTML = '<div class="loading">Cargando partidos en vivo...</div>';

    try {
        // Llamar a ESPN a través de nuestro servidor (evita CORS)
        const response = await fetch(`${API_SERVER}/api/espn/scoreboard`);

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
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>❌ Error al cargar los partidos</h3>
                <p>${error.message}</p>
                <p style="margin-top: 15px; color: #666;">Verifica que el servidor esté corriendo</p>
            </div>
        `;
    }
}

// Renderizar partidos de ESPN
function renderESPNGames(events) {
    const gamesContainer = document.getElementById('games-container');
    
    if (!events || events.length === 0) {
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>🏀 No hay partidos disponibles</h3>
                <p>Intenta de nuevo más tarde</p>
            </div>
        `;
        return;
    }

    gamesContainer.innerHTML = events.map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const homeScore = homeTeam.score || '0';
        const awayScore = awayTeam.score || '0';
        
        // Estado del partido
        const status = event.status;
        const statusType = status.type.name; // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
        const clock = status.displayClock || '';
        const period = status.period || 0;
        
        let statusHTML = '';
        let isLive = false;
        let timeDisplay = '';
        
        if (statusType === 'STATUS_FINAL') {
            statusHTML = '<div class="game-status final">FINAL</div>';
        } else if (statusType === 'STATUS_IN_PROGRESS') {
            isLive = true;
            // Mostrar tiempo restante y cuarto
            const periodText = period <= 4 ? `Q${period}` : `OT${period - 4}`;
            timeDisplay = `${clock} - ${periodText}`;
            statusHTML = `<div class="game-status live"><span class="live-indicator"></span>EN VIVO - ${timeDisplay}</div>`;
        } else if (statusType === 'STATUS_HALFTIME') {
            isLive = true;
            statusHTML = '<div class="game-status live"><span class="live-indicator"></span>DESCANSO</div>';
        } else {
            // Programado
            const gameDate = new Date(event.date);
            const dateStr = gameDate.toLocaleTimeString('es-ES', { 
                hour: '2-digit',
                minute: '2-digit'
            });
            statusHTML = `<div class="game-status scheduled">${dateStr}</div>`;
        }

        // Datos para buscar stats en BallDontLie
        const gameDate = new Date(event.date).toISOString().split('T')[0];
        const homeAbbr = homeTeam.team.abbreviation;
        const awayAbbr = awayTeam.team.abbreviation;

        // Logos de equipos
        const homeLogo = homeTeam.team.logo || '';
        const awayLogo = awayTeam.team.logo || '';

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

// ============ STATS DE JUGADORES (NBA CDN EN VIVO + BALLDONTLIE) ============

// Mapa de abreviaturas ESPN -> NBA CDN (las que difieren)
const espnToNbaMap = {
    'WSH': 'WAS',  // Washington
    'NY': 'NYK',   // New York Knicks
    'GS': 'GSW',   // Golden State
    'UTAH': 'UTA', // Utah
    'SA': 'SAS',   // San Antonio
    'NO': 'NOP',   // New Orleans
    'PHX': 'PHX',  // Phoenix (igual)
    'LAL': 'LAL', 'LAC': 'LAC', 'BOS': 'BOS', 'MIA': 'MIA',
    'CHI': 'CHI', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN',
    'DET': 'DET', 'HOU': 'HOU', 'IND': 'IND', 'MEM': 'MEM',
    'MIL': 'MIL', 'MIN': 'MIN', 'OKC': 'OKC', 'ORL': 'ORL',
    'PHI': 'PHI', 'POR': 'POR', 'SAC': 'SAC', 'TOR': 'TOR',
    'ATL': 'ATL', 'BKN': 'BKN', 'CHA': 'CHA'
};

// Convertir abreviatura ESPN a NBA CDN
function toNbaAbbr(espnAbbr) {
    return espnToNbaMap[espnAbbr] || espnAbbr;
}

// Abrir modal de stats - intenta primero NBA CDN (en vivo), luego BallDontLie
async function openStatsModal(date, team1, team2, team1Name, team2Name) {
    const modal = document.getElementById('stats-modal');
    const modalHeader = document.getElementById('stats-modal-header');
    const modalBody = document.getElementById('stats-modal-body');
    
    modal.style.display = 'flex';
    modalHeader.innerHTML = `<h2>${team2Name} vs ${team1Name}</h2><p>Estadísticas de Jugadores</p>`;
    modalBody.innerHTML = '<div class="loading">Buscando estadísticas en vivo...</div>';
    
    try {
        // 1. Primero intentar obtener stats en vivo de NBA CDN
        const nbaGameId = await findNBAGameId(team1, team2);
        
        if (nbaGameId) {
            console.log(`🏀 Encontrado NBA Game ID: ${nbaGameId}`);
            const liveStats = await fetchNBALiveStats(nbaGameId);
            
            if (liveStats) {
                renderNBALiveStats(liveStats);
                return;
            }
        }
        
        // 2. Si no hay stats en vivo, intentar BallDontLie (partidos terminados)
        console.log('📊 Intentando BallDontLie...');
        modalBody.innerHTML = '<div class="loading">Buscando estadísticas del partido...</div>';
        
        const searchResponse = await fetch(`${API_SERVER}/api/balldontlie/game?date=${date}&team1=${team1}&team2=${team2}`);
        const searchData = await searchResponse.json();
        
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

// Buscar Game ID de NBA CDN
async function findNBAGameId(team1, team2) {
    try {
        const response = await fetch(`${API_SERVER}/api/nba/scoreboard`);
        if (!response.ok) return null;
        
        const data = await response.json();
        const games = data.scoreboard?.games || [];
        
        // Convertir abreviaturas ESPN a NBA CDN
        const nbaTeam1 = toNbaAbbr(team1);
        const nbaTeam2 = toNbaAbbr(team2);
        
        console.log(`🔍 Buscando partido: ${team1}(${nbaTeam1}) vs ${team2}(${nbaTeam2})`);
        
        // Buscar el partido por equipos
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
        
        return game ? game.gameId : null;
    } catch (error) {
        console.error('Error buscando NBA Game ID:', error);
        return null;
    }
}

// Obtener stats en vivo de NBA CDN
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

// Renderizar stats en vivo de NBA CDN
function renderNBALiveStats(game) {
    const modalBody = document.getElementById('stats-modal-body');
    const modalHeader = document.getElementById('stats-modal-header');
    
    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    
    // Actualizar header con marcador actual
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
                        ${(awayTeam.players || []).filter(p => p.statistics).map(p => {
                            const s = p.statistics;
                            return `
                                <tr class="${p.oncourt === '1' ? 'on-court' : ''}">
                                    <td class="player-name">${p.name}${p.oncourt === '1' ? ' 🏃' : ''}</td>
                                    <td>${s.minutes || '-'}</td>
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
                        ${(homeTeam.players || []).filter(p => p.statistics).map(p => {
                            const s = p.statistics;
                            return `
                                <tr class="${p.oncourt === '1' ? 'on-court' : ''}">
                                    <td class="player-name">${p.name}${p.oncourt === '1' ? ' 🏃' : ''}</td>
                                    <td>${s.minutes || '-'}</td>
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

// Renderizar stats de jugadores
function renderPlayerStats(stats, team1Abbr, team2Abbr, team1Name, team2Name) {
    const modalBody = document.getElementById('stats-modal-body');
    
    // Separar jugadores por equipo
    const team1Stats = stats.filter(s => s.team.abbreviation === team1Abbr);
    const team2Stats = stats.filter(s => s.team.abbreviation === team2Abbr);
    
    // Si no coinciden las abreviaturas, usar todos los stats divididos por equipo
    let homeStats, awayStats;
    if (team1Stats.length === 0 && team2Stats.length === 0) {
        // Agrupar por equipo_id
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
                                <td>${s.min || '-'}</td>
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
                                <td>${s.min || '-'}</td>
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

// Cerrar modal
function closeStatsModal() {
    document.getElementById('stats-modal').style.display = 'none';
}

// Cerrar modal al hacer click fuera
window.onclick = function(event) {
    const modal = document.getElementById('stats-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// ============ AUTO-ACTUALIZACIÓN ============

// Actualizar marcadores cada 15 segundos
setInterval(() => {
    loadGames();
}, 15000);

// Cargar partidos al iniciar
loadGames();

// ============ NOTICIAS ESPN ============

// Cargar noticias de ESPN (API gratuita sin key)
async function loadNews() {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '<div class="loading">Cargando noticias de ESPN...</div>';

    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news');
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const articles = data.articles;

        if (!articles || articles.length === 0) {
            newsContainer.innerHTML = `
                <div class="error-message">
                    <h3>📰 No hay noticias disponibles</h3>
                    <p>Intenta de nuevo más tarde</p>
                </div>
            `;
            return;
        }

        renderNews(articles);

    } catch (error) {
        console.error('Error cargando noticias:', error);
        newsContainer.innerHTML = `
            <div class="error-message">
                <h3>❌ Error al cargar las noticias</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Renderizar noticias
function renderNews(articles) {
    const newsContainer = document.getElementById('news-container');
    
    // Mostrar máximo 6 noticias
    const newsToShow = articles.slice(0, 6);
    
    newsContainer.innerHTML = newsToShow.map(article => {
        // Obtener imagen (si existe)
        const imageUrl = article.images && article.images.length > 0 
            ? article.images[0].url 
            : 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop';
        
        // Obtener categoría
        const category = article.categories && article.categories.length > 0 
            ? article.categories[0].description || 'NBA'
            : 'NBA';
        
        // Obtener descripción
        const description = article.description || '';
        
        // URL del artículo
        const articleUrl = article.links?.web?.href || '#';

        return `
            <article class="news-card" onclick="window.open('${articleUrl}', '_blank')">
                <img src="${imageUrl}" alt="${article.headline}" class="news-image" onerror="this.src='https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop'">
                <div class="news-content">
                    <div class="news-category">${category}</div>
                    <h3 class="news-title">${article.headline}</h3>
                    <p class="news-excerpt">${description}</p>
                </div>
            </article>
        `;
    }).join('');
}

// Cargar noticias al iniciar
loadNews();

// ============ STANDINGS (CLASIFICACIÓN) ============

// Cargar standings de la NBA desde ESPN
async function loadStandings() {
    const eastContainer = document.getElementById('east-standings');
    const westContainer = document.getElementById('west-standings');
    
    if (!eastContainer || !westContainer) return;
    
    eastContainer.innerHTML = '<h3>🏀 Conferencia Este</h3><div class="loading">Cargando clasificación...</div>';
    westContainer.innerHTML = '<h3>🏀 Conferencia Oeste</h3><div class="loading">Cargando clasificación...</div>';
    
    try {
        const response = await fetch(`${API_SERVER}/api/standings`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // ESPN tiene estructura: children[0] = Este, children[1] = Oeste
        const conferences = data.children || [];
        
        const eastConference = conferences.find(c => c.name === 'Eastern Conference' || c.abbreviation === 'East');
        const westConference = conferences.find(c => c.name === 'Western Conference' || c.abbreviation === 'West');
        
        if (eastConference) {
            renderESPNStandings(eastContainer, 'Conferencia Este', eastConference.standings?.entries || []);
        } else {
            eastContainer.innerHTML = '<h3>🏀 Conferencia Este</h3><p>No hay datos disponibles</p>';
        }
        
        if (westConference) {
            renderESPNStandings(westContainer, 'Conferencia Oeste', westConference.standings?.entries || []);
        } else {
            westContainer.innerHTML = '<h3>🏀 Conferencia Oeste</h3><p>No hay datos disponibles</p>';
        }
        
    } catch (error) {
        console.error('Error cargando standings:', error);
        eastContainer.innerHTML = `<h3>🏀 Conferencia Este</h3><div class="error-message"><p>Error: ${error.message}</p></div>`;
        westContainer.innerHTML = `<h3>🏀 Conferencia Oeste</h3><div class="error-message"><p>Error: ${error.message}</p></div>`;
    }
}

// Renderizar tabla de standings de ESPN
function renderESPNStandings(container, title, entries) {
    if (!entries || entries.length === 0) {
        container.innerHTML = `<h3>🏀 ${title}</h3><p>No hay datos disponibles</p>`;
        return;
    }
    
    // Función helper para obtener stat por nombre
    const getStat = (stats, name) => {
        const stat = stats.find(s => s.name === name || s.type === name);
        return stat ? (stat.displayValue || stat.value || '-') : '-';
    };
    
    // Ordenar por playoffSeed
    const sortedEntries = [...entries].sort((a, b) => {
        const seedA = parseFloat(getStat(a.stats, 'playoffSeed')) || 99;
        const seedB = parseFloat(getStat(b.stats, 'playoffSeed')) || 99;
        return seedA - seedB;
    });
    
    container.innerHTML = `
        <h3>🏀 ${title}</h3>
        <table class="standings-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th>V</th>
                    <th>D</th>
                    <th>%</th>
                    <th>Dif.</th>
                    <th>Racha</th>
                    <th>L10</th>
                </tr>
            </thead>
            <tbody>
                ${sortedEntries.slice(0, 15).map((entry, index) => {
                    const team = entry.team;
                    const stats = entry.stats || [];
                    
                    const wins = getStat(stats, 'wins');
                    const losses = getStat(stats, 'losses');
                    const pct = getStat(stats, 'winPercent');
                    const diff = getStat(stats, 'differential');
                    const streak = getStat(stats, 'streak');
                    const l10 = getStat(stats, 'lasttengames');
                    const seed = parseInt(getStat(stats, 'playoffSeed')) || (index + 1);
                    
                    // Destacar playoffs (top 6), play-in (7-10)
                    let rowClass = '';
                    if (seed <= 6) rowClass = 'playoff-spot';
                    else if (seed <= 10) rowClass = 'playin-spot';
                    
                    const diffNum = parseFloat(diff);
                    const diffClass = diffNum > 0 ? 'positive' : diffNum < 0 ? 'negative' : '';
                    
                    return `
                        <tr class="${rowClass}">
                            <td class="rank">${seed}</td>
                            <td class="team-name-cell">${team.displayName || team.name}</td>
                            <td>${wins}</td>
                            <td>${losses}</td>
                            <td>${pct}</td>
                            <td class="${diffClass}">${diffNum > 0 ? '+' : ''}${diff}</td>
                            <td>${streak}</td>
                            <td>${l10}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="standings-legend">
            <span class="legend-item playoff">● Playoffs (1-6)</span>
            <span class="legend-item playin">● Play-In (7-10)</span>
        </div>
    `;
}

// Cargar standings al iniciar
loadStandings();

// ============ SCROLL SUAVE A SCORES DEL CHATBOT ============

// Función para ir a la sección de Scores con scroll suave
function scrollToScores() {
    document.getElementById('scores').scrollIntoView({behavior: 'smooth'});
    
    // Ejecuta la función de recargar partidos para asegurar datos frescos
    if(typeof loadGames === 'function') { loadGames(); }
}