// ============================================================
// stats-equipos.js - Steams por equipo y jugadores
// Muestra los 30 equipos siempre y carga jugadores + stats de temporada.
// ============================================================

let statsTeamsCache = [];
let currentSelectedTeamKey = '';
let statsEventsBound = false;
let currentSelectedTeamData = null;
let currentSeasonLabel = '';
let currentPlayersByName = new Map();

function openTeamStatsModal() {
    const modal = document.getElementById('team-stats-modal');

    if (!modal) return;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeTeamStatsModal() {
    const modal = document.getElementById('team-stats-modal');

    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTeamByKey(teamKey) {
    return statsTeamsCache.find(team => team.uniqueKey === teamKey) || null;
}

function normalizeNameKey(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function teamIsFavorite(teamAbbr) {
    if (typeof isFavoriteTeam !== 'function') return false;
    return isFavoriteTeam(teamAbbr);
}

function playerIsFavorite(playerName) {
    if (typeof isFavoritePlayer !== 'function') return false;
    return isFavoritePlayer(playerName);
}

function formatNumber(value, digits = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric.toFixed(digits);
}

function formatPercentage(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';

    const normalized = numeric > 1 ? numeric : numeric * 100;
    return `${normalized.toFixed(1)}%`;
}

function buildTeamCardHTML(teamEntry) {
    const isFavorite = teamIsFavorite(teamEntry.abbr);
    const favoriteClass = isFavorite ? 'active' : '';
    const favoriteLabel = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';

    return `
        <div class="team-stat-card" data-team-key="${escapeHtml(teamEntry.uniqueKey)}">
            <button
                type="button"
                class="team-stat-star-btn ${favoriteClass}"
                data-action="toggle-team-favorite"
                data-team-key="${escapeHtml(teamEntry.uniqueKey)}"
                aria-label="${favoriteLabel}"
                title="${favoriteLabel}"
            >${isFavorite ? '★' : '☆'}</button>
            <img src="${escapeHtml(teamEntry.logo)}" alt="${escapeHtml(teamEntry.fullName)}" class="team-stat-logo" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546519638-68e109498ffc?w=160&h=160&fit=crop'">
            <span class="team-stat-name">${escapeHtml(teamEntry.fullName)}</span>
            <span class="team-stat-meta">${escapeHtml(teamEntry.abbr)}</span>
        </div>
    `;
}

function renderStatsTeamsGrid(teams) {
    const grid = document.getElementById('stats-teams-grid');
    if (!grid) return;

    if (!Array.isArray(teams) || teams.length === 0) {
        grid.innerHTML = `
            <div class="error-message">
                <h3>No se pudieron cargar los equipos</h3>
                <p>Intenta recargar la pagina en unos segundos.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = teams.map(team => buildTeamCardHTML(team)).join('');
    setStatsSelectionState(currentSelectedTeamKey);
}

function renderStatsPlayersTable(team, season, players) {
    const wrapper = document.getElementById('team-stats-content');
    if (!wrapper) return;

    currentSelectedTeamData = team;
    currentSeasonLabel = season;

    if (!Array.isArray(players) || players.length === 0) {
        currentPlayersByName = new Map();

        wrapper.innerHTML = `
            <div class="team-stats-panel-header">
                <h3>${escapeHtml(team.fullName)}</h3>
                <p>Temporada ${escapeHtml(season)} | Sin jugadores disponibles</p>
            </div>
            <div class="error-message">
                <h3>Sin datos para mostrar</h3>
                <p>No se encontraron jugadores para este equipo.</p>
            </div>
        `;
        return;
    }

    const sortedPlayers = [...players].sort((a, b) => {
        const pointsA = Number(a?.season_stats?.pts || 0);
        const pointsB = Number(b?.season_stats?.pts || 0);
        return pointsB - pointsA;
    });

    currentPlayersByName = new Map(
        sortedPlayers.map(player => {
            const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador NBA';
            return [normalizeNameKey(playerName), player];
        })
    );

    wrapper.innerHTML = `
        <div class="team-stats-panel-header">
            <h3>${escapeHtml(team.fullName)}</h3>
            <p>Temporada ${escapeHtml(season)} | Click en ☆ para favoritos</p>
        </div>
        <div class="team-stats-table-wrap">
            <table class="team-stats-table">
                <thead>
                    <tr>
                        <th>Fav</th>
                        <th>Jugador</th>
                        <th>POS</th>
                        <th>PJ</th>
                        <th>PTS</th>
                        <th>REB</th>
                        <th>AST</th>
                        <th>STL</th>
                        <th>BLK</th>
                        <th>MIN</th>
                        <th>FG%</th>
                        <th>3PT%</th>
                        <th>FT%</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedPlayers.map(player => {
                        const stats = player.season_stats || {};
                        const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador NBA';
                        const favorite = playerIsFavorite(playerName);

                        return `
                            <tr>
                                <td>
                                    <button
                                        type="button"
                                        class="player-star-btn ${favorite ? 'active' : ''}"
                                        data-action="toggle-player-favorite"
                                        data-player-name="${escapeHtml(playerName)}"
                                        aria-label="${favorite ? 'Quitar favorito' : 'Agregar favorito'}"
                                        title="${favorite ? 'Quitar favorito' : 'Agregar favorito'}"
                                    >${favorite ? '★' : '☆'}</button>
                                </td>
                                <td class="player-name-cell">${escapeHtml(playerName)}</td>
                                <td>${escapeHtml(player.position || '-')}</td>
                                <td>${escapeHtml(formatNumber(stats.games_played, 0))}</td>
                                <td class="highlight-cell">${escapeHtml(formatNumber(stats.pts))}</td>
                                <td>${escapeHtml(formatNumber(stats.reb))}</td>
                                <td>${escapeHtml(formatNumber(stats.ast))}</td>
                                <td>${escapeHtml(formatNumber(stats.stl))}</td>
                                <td>${escapeHtml(formatNumber(stats.blk))}</td>
                                <td>${escapeHtml(formatNumber(stats.min))}</td>
                                <td>${escapeHtml(formatPercentage(stats.fg_pct))}</td>
                                <td>${escapeHtml(formatPercentage(stats.fg3_pct))}</td>
                                <td>${escapeHtml(formatPercentage(stats.ft_pct))}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function setStatsSelectionState(selectedKey) {
    const cards = document.querySelectorAll('.team-stat-card');

    cards.forEach(card => {
        card.classList.remove('active');

        if (card.dataset.teamKey === selectedKey) {
            card.classList.add('active');
        }
    });
}

function toggleTeamFavoriteFromStats(teamKey, buttonElement) {
    const team = getTeamByKey(teamKey);
    if (!team) return;

    let isNowFavorite = false;

    if (typeof toggleFavoriteTeam === 'function') {
        isNowFavorite = toggleFavoriteTeam(team.abbr, team.fullName, {
            blTeamId: team.blTeamId,
            nbaTeamId: team.nbaTeamId,
            logo: team.logo
        });
    } else if (typeof addFavoriteTeam === 'function') {
        isNowFavorite = addFavoriteTeam(team.abbr, team.fullName);
    }

    if (!buttonElement) return;

    buttonElement.classList.toggle('active', isNowFavorite);
    buttonElement.textContent = isNowFavorite ? '★' : '☆';
    buttonElement.setAttribute('aria-label', isNowFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
    buttonElement.setAttribute('title', isNowFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
}

function togglePlayerFavoriteFromStats(playerName, buttonElement) {
    if (!playerName) return;

    let isNowFavorite = false;
    const playerData = currentPlayersByName.get(normalizeNameKey(playerName));
    const playerMetadata = playerData
        ? {
            teamAbbr: currentSelectedTeamData?.abbr || '',
            teamName: currentSelectedTeamData?.fullName || '',
            position: playerData.position || '-',
            headshot: playerData.headshot || null,
            season: currentSeasonLabel,
            season_stats: playerData.season_stats || null
        }
        : null;

    if (typeof toggleFavoritePlayer === 'function') {
        isNowFavorite = toggleFavoritePlayer(playerName, playerMetadata);
    } else if (typeof addFavoritePlayer === 'function') {
        isNowFavorite = addFavoritePlayer(playerName);
    }

    if (!buttonElement) return;

    buttonElement.classList.toggle('active', isNowFavorite);
    buttonElement.textContent = isNowFavorite ? '★' : '☆';
    buttonElement.setAttribute('aria-label', isNowFavorite ? 'Quitar favorito' : 'Agregar favorito');
    buttonElement.setAttribute('title', isNowFavorite ? 'Quitar favorito' : 'Agregar favorito');
}

function bindStatsPageEvents() {
    if (statsEventsBound) return;

    const grid = document.getElementById('stats-teams-grid');
    const content = document.getElementById('team-stats-content');
    const modal = document.getElementById('team-stats-modal');
    const modalCloseButton = document.getElementById('team-stats-modal-close');
    if (!grid || !content || !modal || !modalCloseButton) return;

    grid.addEventListener('click', event => {
        const favoriteButton = event.target.closest('[data-action="toggle-team-favorite"]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
            toggleTeamFavoriteFromStats(favoriteButton.dataset.teamKey, favoriteButton);
            return;
        }

        const teamCard = event.target.closest('.team-stat-card');
        if (!teamCard) return;

        selectTeamForStatsByKey(teamCard.dataset.teamKey);
    });

    content.addEventListener('click', event => {
        const favoriteButton = event.target.closest('[data-action="toggle-player-favorite"]');
        if (!favoriteButton) return;

        event.preventDefault();
        event.stopPropagation();
        togglePlayerFavoriteFromStats(favoriteButton.dataset.playerName, favoriteButton);
    });

    modalCloseButton.addEventListener('click', () => {
        closeTeamStatsModal();
    });

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closeTeamStatsModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeTeamStatsModal();
        }
    });

    statsEventsBound = true;
}

async function selectTeamForStatsByKey(teamKey) {
    const selectedTeam = getTeamByKey(teamKey);
    if (!selectedTeam) return;

    openTeamStatsModal();

    const wrapper = document.getElementById('team-stats-content');
    if (wrapper) {
        wrapper.innerHTML = '<div class="loading">Cargando jugadores y estadisticas...</div>';
    }

    currentSelectedTeamKey = teamKey;
    currentSelectedTeamData = selectedTeam;
    setStatsSelectionState(teamKey);

    try {
        const response = await fetch(`${API_SERVER}/api/teams/${selectedTeam.blTeamId}/players-stats`);
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const team = data.team || selectedTeam;
        const season = data.season || new Date().getFullYear() - 1;
        const players = Array.isArray(data.data) ? data.data : [];

        renderStatsPlayersTable(team, season, players);
    } catch (error) {
        console.error('Error cargando jugadores del equipo:', error);
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="error-message">
                    <h3>Error al cargar el equipo</h3>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }
}

async function initTeamStatsPage() {
    const grid = document.getElementById('stats-teams-grid');
    const content = document.getElementById('team-stats-content');
    if (!grid || !content) return;

    bindStatsPageEvents();
    currentSelectedTeamKey = '';
    currentSelectedTeamData = null;
    currentSeasonLabel = '';
    currentPlayersByName = new Map();

    closeTeamStatsModal();

    grid.innerHTML = '<div class="loading">Cargando los 30 equipos NBA...</div>';
    content.innerHTML = `
        <div class="team-stats-panel-header">
            <h3>Selecciona un equipo</h3>
            <p>Paso 1: elige un logo en la izquierda. Paso 2: aqui veras jugadores y estadísticas.</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_SERVER}/api/teams/all`);
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const teams = Array.isArray(data.data) ? data.data : [];

        statsTeamsCache = teams
            .map(team => ({
                ...team,
                uniqueKey: `team-${team.blTeamId}`
            }))
            .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));

        renderStatsTeamsGrid(statsTeamsCache);
    } catch (error) {
        console.error('Error inicializando pagina Steams:', error);
        grid.innerHTML = `
            <div class="error-message">
                <h3>No se pudieron cargar los equipos</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

window.initTeamStatsPage = initTeamStatsPage;
window.selectTeamForStatsByKey = selectTeamForStatsByKey;
window.closeTeamStatsModal = closeTeamStatsModal;
