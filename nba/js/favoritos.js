// ============================================================
// favoritos.js - Gestion de favoritos (equipos y jugadores)
// Muestra favoritos con stats y proximo partido.
// ============================================================

const NBA_TEAM_OPTIONS = [
    { abbr: 'ATL', name: 'Atlanta Hawks' },
    { abbr: 'BOS', name: 'Boston Celtics' },
    { abbr: 'BKN', name: 'Brooklyn Nets' },
    { abbr: 'CHA', name: 'Charlotte Hornets' },
    { abbr: 'CHI', name: 'Chicago Bulls' },
    { abbr: 'CLE', name: 'Cleveland Cavaliers' },
    { abbr: 'DAL', name: 'Dallas Mavericks' },
    { abbr: 'DEN', name: 'Denver Nuggets' },
    { abbr: 'DET', name: 'Detroit Pistons' },
    { abbr: 'GSW', name: 'Golden State Warriors' },
    { abbr: 'HOU', name: 'Houston Rockets' },
    { abbr: 'IND', name: 'Indiana Pacers' },
    { abbr: 'LAC', name: 'LA Clippers' },
    { abbr: 'LAL', name: 'Los Angeles Lakers' },
    { abbr: 'MEM', name: 'Memphis Grizzlies' },
    { abbr: 'MIA', name: 'Miami Heat' },
    { abbr: 'MIL', name: 'Milwaukee Bucks' },
    { abbr: 'MIN', name: 'Minnesota Timberwolves' },
    { abbr: 'NOP', name: 'New Orleans Pelicans' },
    { abbr: 'NYK', name: 'New York Knicks' },
    { abbr: 'OKC', name: 'Oklahoma City Thunder' },
    { abbr: 'ORL', name: 'Orlando Magic' },
    { abbr: 'PHI', name: 'Philadelphia 76ers' },
    { abbr: 'PHX', name: 'Phoenix Suns' },
    { abbr: 'POR', name: 'Portland Trail Blazers' },
    { abbr: 'SAC', name: 'Sacramento Kings' },
    { abbr: 'SAS', name: 'San Antonio Spurs' },
    { abbr: 'TOR', name: 'Toronto Raptors' },
    { abbr: 'UTA', name: 'Utah Jazz' },
    { abbr: 'WAS', name: 'Washington Wizards' }
];

const NBA_TEAM_ID_BY_ABBR = {
    ATL: '1610612737',
    BOS: '1610612738',
    BKN: '1610612751',
    CHA: '1610612766',
    CHI: '1610612741',
    CLE: '1610612739',
    DAL: '1610612742',
    DEN: '1610612743',
    DET: '1610612765',
    GSW: '1610612744',
    HOU: '1610612745',
    IND: '1610612754',
    LAC: '1610612746',
    LAL: '1610612747',
    MEM: '1610612763',
    MIA: '1610612748',
    MIL: '1610612749',
    MIN: '1610612750',
    NOP: '1610612740',
    NYK: '1610612752',
    OKC: '1610612760',
    ORL: '1610612753',
    PHI: '1610612755',
    PHX: '1610612756',
    POR: '1610612757',
    SAC: '1610612758',
    SAS: '1610612759',
    TOR: '1610612761',
    UTA: '1610612762',
    WAS: '1610612764'
};

const BL_TEAM_ID_BY_ABBR = {
    ATL: 1,
    BOS: 2,
    BKN: 3,
    CHA: 4,
    CHI: 5,
    CLE: 6,
    DAL: 7,
    DEN: 8,
    DET: 9,
    GSW: 10,
    HOU: 11,
    IND: 12,
    LAC: 13,
    LAL: 14,
    MEM: 15,
    MIA: 16,
    MIL: 17,
    MIN: 18,
    NOP: 19,
    NYK: 20,
    OKC: 21,
    ORL: 22,
    PHI: 23,
    PHX: 24,
    POR: 25,
    SAC: 26,
    SAS: 27,
    TOR: 28,
    UTA: 29,
    WAS: 30
};

let favoritesStorageKey = 'nba_favorites_guest';
let favoritesState = {
    teams: [],
    players: []
};
let favoritesFeedbackTimeoutId = null;
let favoritesInitialized = false;
let favoritesSearchTerm = '';

const favoritesInsightsState = {
    loading: false,
    requestId: 0,
    teamsByAbbr: {},
    playersByName: {}
};

function normalizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeNameKey(value) {
    return normalizeText(value).toLowerCase();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value, digits = 1) {
    const numeric = toFiniteNumber(value);
    if (numeric === null) return '-';
    return numeric.toFixed(digits);
}

function formatPercentage(value) {
    const numeric = toFiniteNumber(value);
    if (numeric === null) return '-';

    const normalized = numeric > 1 ? numeric : numeric * 100;
    return `${normalized.toFixed(1)}%`;
}

function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function sanitizeSeasonStats(stats) {
    if (!stats || typeof stats !== 'object') return null;

    const safeStats = {
        games_played: toFiniteNumber(stats.games_played),
        pts: toFiniteNumber(stats.pts),
        reb: toFiniteNumber(stats.reb),
        ast: toFiniteNumber(stats.ast),
        stl: toFiniteNumber(stats.stl),
        blk: toFiniteNumber(stats.blk),
        min: toFiniteNumber(stats.min),
        fg_pct: toFiniteNumber(stats.fg_pct),
        fg3_pct: toFiniteNumber(stats.fg3_pct),
        ft_pct: toFiniteNumber(stats.ft_pct)
    };

    const hasAtLeastOneValue = Object.values(safeStats).some(value => value !== null);
    return hasAtLeastOneValue ? safeStats : null;
}

function sanitizeTeamEntry(teamRaw) {
    const abbr = normalizeText(teamRaw?.abbr).toUpperCase();
    const name = normalizeText(teamRaw?.name);

    if (!abbr || !name) return null;

    const blTeamId = Number(teamRaw?.blTeamId) || BL_TEAM_ID_BY_ABBR[abbr] || null;
    const nbaTeamId = normalizeText(teamRaw?.nbaTeamId) || NBA_TEAM_ID_BY_ABBR[abbr] || '';

    return {
        abbr,
        name,
        blTeamId,
        nbaTeamId,
        logo: normalizeText(teamRaw?.logo) || getTeamLogoByAbbr(abbr)
    };
}

function sanitizePlayerEntry(playerRaw) {
    const name = normalizeText(playerRaw?.name);
    if (!name) return null;

    const teamAbbr = normalizeText(playerRaw?.teamAbbr).toUpperCase();

    return {
        name,
        teamAbbr,
        teamName: normalizeText(playerRaw?.teamName),
        position: normalizeText(playerRaw?.position),
        headshot: normalizeText(playerRaw?.headshot),
        season: normalizeText(playerRaw?.season),
        season_stats: sanitizeSeasonStats(playerRaw?.season_stats)
    };
}

function getApiBaseUrl() {
    if (typeof API_SERVER === 'string' && API_SERVER.trim()) {
        return API_SERVER;
    }

    return 'http://localhost:3000';
}

// Helper: obtener token JWT
function getAuthToken() {
    return localStorage.getItem('nba_token') || null;
}

// Helper: llamar a la API de favoritos
function favoritesApiCall(method, path, body) {
    const token = getAuthToken();
    if (!token) return Promise.resolve(null);

    const apiBase = getApiBaseUrl();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    return fetch(`${apiBase}${path}`, options)
        .then(r => r.ok ? r.json() : null)
        .catch(err => { console.warn('API favoritos error:', err); return null; });
}

function isFavoritesPage() {
    return Boolean(document.getElementById('favorite-teams-list') || document.getElementById('favorite-players-list'));
}

function getFavoritesStorageKey() {
    try {
        const userRaw = localStorage.getItem('nba_user');
        if (!userRaw) return 'nba_favorites_guest';

        const user = JSON.parse(userRaw);
        const username = normalizeText(user.username || 'guest').toLowerCase();
        return `nba_favorites_${username || 'guest'}`;
    } catch (error) {
        console.warn('No se pudo obtener el usuario actual para favoritos:', error);
        return 'nba_favorites_guest';
    }
}

function getTeamLogoByAbbr(abbr) {
    const normalizedAbbr = normalizeText(abbr).toUpperCase();
    const nbaTeamId = NBA_TEAM_ID_BY_ABBR[normalizedAbbr];

    if (!nbaTeamId) {
        return 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100&h=100&fit=crop';
    }

    return `https://cdn.nba.com/logos/nba/${nbaTeamId}/global/L/logo.svg`;
}

function populateFavoriteTeamSelect() {
    const select = document.getElementById('favorite-team-select');
    if (!select) return;

    const sortedTeams = [...NBA_TEAM_OPTIONS].sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = [
        '<option value="">Selecciona un equipo</option>',
        ...sortedTeams.map(team => `<option value="${team.abbr}">${team.name} (${team.abbr})</option>`)
    ].join('');
}

function loadFavoritesState() {
    try {
        const savedRaw = localStorage.getItem(favoritesStorageKey);
        if (!savedRaw) {
            favoritesState = { teams: [], players: [] };
        } else {
            const parsed = JSON.parse(savedRaw);
            favoritesState = {
                teams: Array.isArray(parsed?.teams)
                    ? parsed.teams.map(team => sanitizeTeamEntry(team)).filter(Boolean)
                    : [],
                players: Array.isArray(parsed?.players)
                    ? parsed.players.map(player => sanitizePlayerEntry(player)).filter(Boolean)
                    : []
            };
        }
    } catch (error) {
        console.warn('No se pudieron cargar los favoritos guardados:', error);
        favoritesState = { teams: [], players: [] };
    }

    // Intentar cargar desde el servidor si hay token
    loadFavoritesFromServer();
}

async function loadFavoritesFromServer() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const data = await favoritesApiCall('GET', '/api/favorites');
        if (!data) return;

        // Convertir formato de la API al formato local
        const serverTeams = (data.teams || []).map(t => sanitizeTeamEntry({
            abbr: t.team_abbr,
            name: t.team_name
        })).filter(Boolean);

        const serverPlayers = (data.players || []).map(p => sanitizePlayerEntry({
            name: p.player_name,
            teamAbbr: p.team_abbr
        })).filter(Boolean);

        // Fusionar: si el servidor tiene datos, usarlos como fuente de verdad
        if (serverTeams.length > 0 || serverPlayers.length > 0) {
            favoritesState.teams = serverTeams;
            favoritesState.players = serverPlayers;
            // Actualizar localStorage
            localStorage.setItem(favoritesStorageKey, JSON.stringify(favoritesState));
            renderFavorites();
        }
    } catch (err) {
        console.warn('Error cargando favoritos del servidor:', err);
    }
}

function ensureFavoritesStateReady() {
    if (favoritesInitialized) return;

    favoritesStorageKey = getFavoritesStorageKey();
    loadFavoritesState();
    favoritesInitialized = true;
}

function saveFavoritesState() {
    ensureFavoritesStateReady();
    localStorage.setItem(favoritesStorageKey, JSON.stringify(favoritesState));
}

function showFavoritesFeedback(message, isError) {
    const feedback = document.getElementById('favorites-feedback');
    if (!feedback) return;

    feedback.textContent = message || '';
    feedback.classList.remove('success', 'error');

    if (!message) return;
    feedback.classList.add(isError ? 'error' : 'success');

    if (favoritesFeedbackTimeoutId) {
        clearTimeout(favoritesFeedbackTimeoutId);
    }

    favoritesFeedbackTimeoutId = window.setTimeout(() => {
        feedback.textContent = '';
        feedback.classList.remove('success', 'error');
    }, 2600);
}

function getSearchTermNormalized() {
    return normalizeText(favoritesSearchTerm).toLowerCase();
}

function getFilteredFavoriteTeams() {
    const query = getSearchTermNormalized();

    return favoritesState.teams
        .map((team, index) => ({ ...team, index }))
        .filter(team => {
            if (!query) return true;
            const haystack = `${team.abbr} ${team.name}`.toLowerCase();
            return haystack.includes(query);
        });
}

function getFilteredFavoritePlayers() {
    const query = getSearchTermNormalized();

    return favoritesState.players
        .map((player, index) => ({ ...player, index }))
        .filter(player => {
            if (!query) return true;

            const haystack = `${player.name} ${player.teamAbbr || ''} ${player.teamName || ''}`.toLowerCase();
            return haystack.includes(query);
        });
}

function updateFavoritesSummary() {
    const teamsCount = favoritesState.teams.length;
    const playersCount = favoritesState.players.length;
    const totalCount = teamsCount + playersCount;

    const teamsCountElement = document.getElementById('favorites-teams-count');
    const playersCountElement = document.getElementById('favorites-players-count');
    const totalCountElement = document.getElementById('favorites-total-count');
    const teamsPill = document.getElementById('favorites-teams-pill');
    const playersPill = document.getElementById('favorites-players-pill');

    if (teamsCountElement) teamsCountElement.textContent = String(teamsCount);
    if (playersCountElement) playersCountElement.textContent = String(playersCount);
    if (totalCountElement) totalCountElement.textContent = String(totalCount);
    if (teamsPill) teamsPill.textContent = String(teamsCount);
    if (playersPill) playersPill.textContent = String(playersCount);
}

function formatNextGameLine(nextGame) {
    if (!nextGame) {
        return 'Proximo partido: sin datos disponibles.';
    }

    const rivalRef = nextGame.isHome
        ? `vs ${nextGame.opponentAbbr || 'NBA'}`
        : `@ ${nextGame.opponentAbbr || 'NBA'}`;

    const dateText = formatDateTime(nextGame.gameDate);
    const statusText = normalizeText(nextGame.status) || 'Programado';

    return `Proximo partido: ${rivalRef} · ${dateText} · ${statusText}`;
}

function getTeamInsight(teamAbbr) {
    return favoritesInsightsState.teamsByAbbr[normalizeText(teamAbbr).toUpperCase()] || null;
}

function getPlayerInsight(playerName) {
    return favoritesInsightsState.playersByName[normalizeNameKey(playerName)] || null;
}

function buildTeamLeaderChip(label, leader) {
    if (!leader) {
        return `<span class="favorite-stat-chip">${label}: -</span>`;
    }

    return `<span class="favorite-stat-chip">${label}: ${escapeHtml(leader.name)} ${escapeHtml(formatNumber(leader.value))}</span>`;
}

function buildPlayerInsightFromStored(player) {
    if (!player || !player.season_stats) return null;

    return {
        name: player.name,
        teamAbbr: player.teamAbbr,
        teamName: player.teamName,
        position: player.position,
        headshot: player.headshot,
        season: player.season,
        season_stats: player.season_stats,
        nextGame: null
    };
}

function renderFavoriteTeams() {
    const list = document.getElementById('favorite-teams-list');
    if (!list) return;

    if (favoritesState.teams.length === 0) {
        list.innerHTML = '<li class="favorite-empty">Aun no tienes equipos favoritos. Agregalos desde Steams con la estrella ☆.</li>';
        return;
    }

    const filteredTeams = getFilteredFavoriteTeams();
    if (filteredTeams.length === 0) {
        list.innerHTML = '<li class="favorite-empty">No hay equipos que coincidan con tu busqueda.</li>';
        return;
    }

    list.innerHTML = filteredTeams
        .map(team => {
            const teamInsight = getTeamInsight(team.abbr);
            const loadingStatsText = favoritesInsightsState.loading && !teamInsight
                ? '<p class="favorite-meta-line">Cargando estadísticas del equipo...</p>'
                : '';

            const seasonText = teamInsight?.season
                ? `<p class="favorite-meta-line">Temporada: ${escapeHtml(teamInsight.season)}</p>`
                : '<p class="favorite-meta-line">Temporada: sin datos</p>';

            const chips = teamInsight
                ? `
                    <div class="favorite-stats-grid">
                        ${buildTeamLeaderChip('Max PTS', teamInsight.topScorer)}
                        ${buildTeamLeaderChip('Max REB', teamInsight.topRebounder)}
                        ${buildTeamLeaderChip('Max AST', teamInsight.topAssist)}
                    </div>
                `
                : '';

            const nextGameText = `<p class="favorite-next-game">${escapeHtml(formatNextGameLine(teamInsight?.nextGame))}</p>`;

            return `
                <li class="favorite-item favorite-item-detailed favorite-team-item">
                    <div class="favorite-item-top">
                        <div class="favorite-main">
                            <img src="${escapeHtml(team.logo || getTeamLogoByAbbr(team.abbr))}" alt="${escapeHtml(team.name)}" class="favorite-team-logo" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100&h=100&fit=crop'">
                            <span class="favorite-pill"><span class="favorite-abbr">${escapeHtml(team.abbr)}</span>${escapeHtml(team.name)}</span>
                        </div>
                        <button class="favorite-remove-btn" onclick="removeFavoriteByIndex('team', ${team.index})" aria-label="Quitar equipo favorito">&times;</button>
                    </div>
                    <div class="favorite-details">
                        ${seasonText}
                        ${loadingStatsText}
                        ${chips}
                        ${nextGameText}
                    </div>
                </li>
            `;
        })
        .join('');
}

function renderFavoritePlayers() {
    const list = document.getElementById('favorite-players-list');
    if (!list) return;

    if (favoritesState.players.length === 0) {
        list.innerHTML = '<li class="favorite-empty">Aun no tienes jugadores favoritos. Agregalos desde Steams con la estrella ☆.</li>';
        return;
    }

    const filteredPlayers = getFilteredFavoritePlayers();
    if (filteredPlayers.length === 0) {
        list.innerHTML = '<li class="favorite-empty">No hay jugadores que coincidan con tu busqueda.</li>';
        return;
    }

    list.innerHTML = filteredPlayers
        .map(player => {
            const dynamicInsight = getPlayerInsight(player.name);
            const storedInsight = buildPlayerInsightFromStored(player);
            const playerInsight = dynamicInsight || storedInsight;
            const stats = playerInsight?.season_stats || null;

            const teamText = playerInsight?.teamAbbr
                ? `${playerInsight.teamAbbr}${playerInsight.position ? ` · ${playerInsight.position}` : ''}`
                : 'Equipo sin resolver';

            const seasonText = playerInsight?.season || '-';
            const nextGameText = formatNextGameLine(playerInsight?.nextGame);

            const statsHtml = stats
                ? `
                    <div class="favorite-stats-grid favorite-stats-grid-player">
                        <span class="favorite-stat-chip">PTS: ${escapeHtml(formatNumber(stats.pts))}</span>
                        <span class="favorite-stat-chip">REB: ${escapeHtml(formatNumber(stats.reb))}</span>
                        <span class="favorite-stat-chip">AST: ${escapeHtml(formatNumber(stats.ast))}</span>
                        <span class="favorite-stat-chip">FG%: ${escapeHtml(formatPercentage(stats.fg_pct))}</span>
                    </div>
                `
                : '<p class="favorite-meta-line">Sin estadísticas disponibles para este jugador.</p>';

            const loadingStatsText = favoritesInsightsState.loading && !playerInsight
                ? '<p class="favorite-meta-line">Buscando estadísticas del jugador...</p>'
                : '';

            return `
                <li class="favorite-item favorite-item-detailed">
                    <div class="favorite-item-top">
                        <div class="favorite-main">
                            <span class="favorite-player-badge">★</span>
                            <span class="favorite-pill">${escapeHtml(player.name)}</span>
                        </div>
                        <button class="favorite-remove-btn" onclick="removeFavoriteByIndex('player', ${player.index})" aria-label="Quitar jugador favorito">&times;</button>
                    </div>
                    <div class="favorite-details">
                        <p class="favorite-meta-line">${escapeHtml(teamText)} · Temporada ${escapeHtml(seasonText)}</p>
                        ${loadingStatsText}
                        ${statsHtml}
                        <p class="favorite-next-game">${escapeHtml(nextGameText)}</p>
                    </div>
                </li>
            `;
        })
        .join('');
}

function renderFavorites() {
    updateFavoritesSummary();
    renderFavoriteTeams();
    renderFavoritePlayers();
}

function addFavoriteTeam(abbr, name, metadata) {
    ensureFavoritesStateReady();

    const normalizedAbbr = normalizeText(abbr).toUpperCase();
    const normalizedName = normalizeText(name);

    if (!normalizedAbbr || !normalizedName) {
        return false;
    }

    const alreadyExistsIndex = favoritesState.teams.findIndex(team => team.abbr === normalizedAbbr);
    if (alreadyExistsIndex >= 0) {
        showFavoritesFeedback('Ese equipo ya esta en favoritos.', true);
        return false;
    }

    const newTeam = sanitizeTeamEntry({
        abbr: normalizedAbbr,
        name: normalizedName,
        blTeamId: metadata?.blTeamId,
        nbaTeamId: metadata?.nbaTeamId,
        logo: metadata?.logo
    });

    if (!newTeam) return false;

    favoritesState.teams.push(newTeam);
    favoritesState.teams.sort((a, b) => a.name.localeCompare(b.name));
    saveFavoritesState();

    // Sincronizar con el servidor
    favoritesApiCall('POST', '/api/favorites/team', {
        team_abbr: normalizedAbbr,
        team_name: normalizedName
    });

    refreshFavoritesViewAndData();
    showFavoritesFeedback(`${normalizedName} agregado a favoritos.`, false);
    return true;
}

function addSelectedTeamFavorite() {
    ensureFavoritesStateReady();

    const select = document.getElementById('favorite-team-select');
    if (!select || !select.value) {
        showFavoritesFeedback('Selecciona un equipo antes de agregar.', true);
        return;
    }

    const selectedTeam = NBA_TEAM_OPTIONS.find(team => team.abbr === select.value);
    if (!selectedTeam) {
        showFavoritesFeedback('No se encontro el equipo seleccionado.', true);
        return;
    }

    const wasAdded = addFavoriteTeam(selectedTeam.abbr, selectedTeam.name);
    if (wasAdded) {
        select.value = '';
    }
}

function addFavoritePlayer(playerName, metadata) {
    ensureFavoritesStateReady();

    const normalizedName = normalizeText(playerName);
    if (!normalizedName) {
        return false;
    }

    const alreadyExists = favoritesState.players.some(
        player => player.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (alreadyExists) {
        showFavoritesFeedback('Ese jugador ya esta en favoritos.', true);
        return false;
    }

    const playerEntry = sanitizePlayerEntry({
        name: normalizedName,
        teamAbbr: metadata?.teamAbbr,
        teamName: metadata?.teamName,
        position: metadata?.position,
        headshot: metadata?.headshot,
        season: metadata?.season,
        season_stats: metadata?.season_stats
    });

    if (!playerEntry) return false;

    favoritesState.players.push(playerEntry);
    favoritesState.players.sort((a, b) => a.name.localeCompare(b.name));
    saveFavoritesState();

    // Sincronizar con el servidor
    favoritesApiCall('POST', '/api/favorites/player', {
        player_name: normalizedName,
        team_abbr: metadata?.teamAbbr || null
    });

    refreshFavoritesViewAndData();
    showFavoritesFeedback(`${normalizedName} agregado a favoritos.`, false);
    return true;
}

function addPlayerFavoriteFromInput() {
    const input = document.getElementById('favorite-player-input');
    if (!input) return;

    const playerName = normalizeText(input.value);
    if (!playerName) {
        showFavoritesFeedback('Escribe un nombre de jugador antes de agregar.', true);
        return;
    }

    const wasAdded = addFavoritePlayer(playerName);
    if (wasAdded) {
        input.value = '';
        input.focus();
    }
}

function removeFavoriteByIndex(type, index) {
    ensureFavoritesStateReady();

    const parsedIndex = Number(index);
    if (Number.isNaN(parsedIndex) || parsedIndex < 0) return;

    if (type === 'team') {
        if (parsedIndex >= favoritesState.teams.length) return;

        const removedTeam = favoritesState.teams.splice(parsedIndex, 1)[0];
        saveFavoritesState();
        // Sincronizar con el servidor
        favoritesApiCall('DELETE', `/api/favorites/team/${encodeURIComponent(removedTeam.abbr)}`);
        refreshFavoritesViewAndData();
        showFavoritesFeedback(`${removedTeam.name} eliminado de favoritos.`, false);
        return;
    }

    if (type === 'player') {
        if (parsedIndex >= favoritesState.players.length) return;

        const removedPlayer = favoritesState.players.splice(parsedIndex, 1)[0];
        saveFavoritesState();
        // Sincronizar con el servidor
        const playerId = removedPlayer.name.toLowerCase().replace(/\s+/g, '_');
        favoritesApiCall('DELETE', `/api/favorites/player/${encodeURIComponent(playerId)}`);
        refreshFavoritesViewAndData();
        showFavoritesFeedback(`${removedPlayer.name} eliminado de favoritos.`, false);
    }
}

function clearAllFavorites() {
    ensureFavoritesStateReady();

    const totalFavorites = favoritesState.teams.length + favoritesState.players.length;
    if (totalFavorites === 0) {
        showFavoritesFeedback('No hay favoritos para limpiar.', true);
        return;
    }

    const shouldClear = window.confirm('Se borraran todos tus favoritos. Deseas continuar?');
    if (!shouldClear) return;

    favoritesState = { teams: [], players: [] };
    saveFavoritesState();

    favoritesInsightsState.teamsByAbbr = {};
    favoritesInsightsState.playersByName = {};

    refreshFavoritesViewAndData();
    showFavoritesFeedback('Favoritos limpiados correctamente.', false);
}

function isFavoriteTeam(abbr) {
    ensureFavoritesStateReady();
    const normalizedAbbr = normalizeText(abbr).toUpperCase();
    return favoritesState.teams.some(team => team.abbr === normalizedAbbr);
}

function isFavoritePlayer(playerName) {
    ensureFavoritesStateReady();
    const normalizedName = normalizeText(playerName).toLowerCase();
    return favoritesState.players.some(player => player.name.toLowerCase() === normalizedName);
}

function toggleFavoriteTeam(abbr, name, metadata) {
    ensureFavoritesStateReady();

    const normalizedAbbr = normalizeText(abbr).toUpperCase();
    const normalizedName = normalizeText(name);

    if (!normalizedAbbr || !normalizedName) {
        return false;
    }

    const existingIndex = favoritesState.teams.findIndex(team => team.abbr === normalizedAbbr);

    if (existingIndex >= 0) {
        const removedTeam = favoritesState.teams.splice(existingIndex, 1)[0];
        saveFavoritesState();
        refreshFavoritesViewAndData();
        showFavoritesFeedback(`${removedTeam.name} eliminado de favoritos.`, false);
        return false;
    }

    const wasAdded = addFavoriteTeam(normalizedAbbr, normalizedName, metadata);
    return Boolean(wasAdded);
}

function toggleFavoritePlayer(playerName, metadata) {
    ensureFavoritesStateReady();

    const normalizedName = normalizeText(playerName);
    if (!normalizedName) {
        return false;
    }

    const existingIndex = favoritesState.players.findIndex(
        player => player.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingIndex >= 0) {
        const removedPlayer = favoritesState.players.splice(existingIndex, 1)[0];
        saveFavoritesState();
        refreshFavoritesViewAndData();
        showFavoritesFeedback(`${removedPlayer.name} eliminado de favoritos.`, false);
        return false;
    }

    const wasAdded = addFavoritePlayer(normalizedName, metadata);
    return Boolean(wasAdded);
}

function refreshFavoritesViewAndData() {
    renderFavorites();

    if (isFavoritesPage()) {
        loadFavoritesInsights();
    }
}

function extractLeader(players, statField) {
    let best = null;

    players.forEach(player => {
        const value = toFiniteNumber(player?.season_stats?.[statField]);
        if (value === null) return;

        if (!best || value > best.value) {
            const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador NBA';
            best = {
                name: playerName,
                value
            };
        }
    });

    return best;
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        return await response.json();
    } catch (error) {
        console.warn('Error de red en favoritos:', error);
        return null;
    }
}

async function loadTeamInsightsForFavorites(teams) {
    const apiBase = getApiBaseUrl();
    const teamInsights = {};

    await Promise.all(teams.map(async team => {
        const abbr = normalizeText(team.abbr).toUpperCase();
        if (!abbr) return;

        teamInsights[abbr] = {
            season: '-',
            topScorer: null,
            topRebounder: null,
            topAssist: null,
            nextGame: null
        };

        const teamId = Number(team.blTeamId) || BL_TEAM_ID_BY_ABBR[abbr];
        if (!teamId) return;

        const data = await fetchJson(`${apiBase}/api/teams/${teamId}/players-stats`);
        if (!data) return;

        const players = Array.isArray(data.data) ? data.data : [];
        teamInsights[abbr] = {
            season: normalizeText(data.season) || '-',
            topScorer: extractLeader(players, 'pts'),
            topRebounder: extractLeader(players, 'reb'),
            topAssist: extractLeader(players, 'ast'),
            nextGame: null
        };
    }));

    return teamInsights;
}

async function loadNextGamesByTeamAbbr(teamAbbrs) {
    const normalizedAbbrs = [...new Set(teamAbbrs.map(abbr => normalizeText(abbr).toUpperCase()).filter(Boolean))];
    if (normalizedAbbrs.length === 0) return {};

    const apiBase = getApiBaseUrl();
    const namesQuery = encodeURIComponent(normalizedAbbrs.join(','));
    const response = await fetchJson(`${apiBase}/api/teams/next-games?abbrs=${namesQuery}&days=10`);

    if (!response || !Array.isArray(response.data)) {
        return {};
    }

    const byAbbr = {};
    response.data.forEach(item => {
        const abbr = normalizeText(item?.teamAbbr).toUpperCase();
        if (!abbr) return;
        byAbbr[abbr] = item;
    });

    return byAbbr;
}

function mergeResolvedPlayerDataIntoState(foundPlayersByName) {
    let hasChanges = false;

    favoritesState.players = favoritesState.players.map(player => {
        const key = normalizeNameKey(player.name);
        const resolved = foundPlayersByName[key];
        if (!resolved) return player;

        const resolvedStats = sanitizeSeasonStats(resolved.season_stats);
        const shouldUpdate = !player.season_stats || !player.teamAbbr;
        if (!shouldUpdate) return player;

        hasChanges = true;
        return {
            ...player,
            teamAbbr: normalizeText(resolved.teamAbbr).toUpperCase(),
            teamName: normalizeText(resolved.teamName),
            position: normalizeText(resolved.position),
            headshot: normalizeText(resolved.headshot),
            season: normalizeText(resolved.season),
            season_stats: resolvedStats
        };
    });

    if (hasChanges) {
        saveFavoritesState();
    }
}

async function loadPlayerInsightsForFavorites(players, teamInsightsByAbbr) {
    const playerInsights = {};

    players.forEach(player => {
        const key = normalizeNameKey(player.name);
        const storedInsight = buildPlayerInsightFromStored(player);

        if (storedInsight) {
            playerInsights[key] = {
                ...storedInsight,
                nextGame: teamInsightsByAbbr[storedInsight.teamAbbr]?.nextGame || null
            };
        }
    });

    const unresolvedPlayers = players
        .filter(player => !playerInsights[normalizeNameKey(player.name)])
        .map(player => player.name);

    if (unresolvedPlayers.length === 0) {
        return playerInsights;
    }

    const apiBase = getApiBaseUrl();
    const namesQuery = encodeURIComponent(unresolvedPlayers.join(','));
    const response = await fetchJson(`${apiBase}/api/players/stats?names=${namesQuery}`);

    if (!response || !Array.isArray(response.data)) {
        return playerInsights;
    }

    const resolvedByName = {};

    response.data.forEach(item => {
        if (!item || !item.name) return;

        const nameKey = normalizeNameKey(item.name);
        const teamAbbr = normalizeText(item.teamAbbr).toUpperCase();
        const insight = {
            name: normalizeText(item.name),
            teamAbbr,
            teamName: normalizeText(item.teamName),
            position: normalizeText(item.position),
            headshot: normalizeText(item.headshot),
            season: normalizeText(item.season),
            season_stats: sanitizeSeasonStats(item.season_stats),
            nextGame: teamInsightsByAbbr[teamAbbr]?.nextGame || null
        };

        playerInsights[nameKey] = insight;
        resolvedByName[nameKey] = insight;
    });

    mergeResolvedPlayerDataIntoState(resolvedByName);
    return playerInsights;
}

async function loadFavoritesInsights() {
    ensureFavoritesStateReady();
    if (!isFavoritesPage()) return;

    const requestId = favoritesInsightsState.requestId + 1;
    favoritesInsightsState.requestId = requestId;
    favoritesInsightsState.loading = true;
    renderFavorites();

    const teamsSnapshot = [...favoritesState.teams];
    const playersSnapshot = [...favoritesState.players];

    if (teamsSnapshot.length === 0 && playersSnapshot.length === 0) {
        favoritesInsightsState.loading = false;
        favoritesInsightsState.teamsByAbbr = {};
        favoritesInsightsState.playersByName = {};
        renderFavorites();
        return;
    }

    try {
        const teamInsightsByAbbr = await loadTeamInsightsForFavorites(teamsSnapshot);
        const nextGamesByAbbr = await loadNextGamesByTeamAbbr(teamsSnapshot.map(team => team.abbr));

        Object.keys(teamInsightsByAbbr).forEach(abbr => {
            teamInsightsByAbbr[abbr].nextGame = nextGamesByAbbr[abbr] || null;
        });

        const playersInsightsByName = await loadPlayerInsightsForFavorites(playersSnapshot, teamInsightsByAbbr);

        if (requestId !== favoritesInsightsState.requestId) {
            return;
        }

        favoritesInsightsState.teamsByAbbr = teamInsightsByAbbr;
        favoritesInsightsState.playersByName = playersInsightsByName;
    } catch (error) {
        console.warn('No se pudieron cargar insights de favoritos:', error);
    } finally {
        if (requestId === favoritesInsightsState.requestId) {
            favoritesInsightsState.loading = false;
            renderFavorites();
        }
    }
}

function bindFavoritesEvents() {
    const playerInput = document.getElementById('favorite-player-input');
    if (playerInput) {
        playerInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            addPlayerFavoriteFromInput();
        });
    }

    const searchInput = document.getElementById('favorites-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', event => {
            favoritesSearchTerm = normalizeText(event.target.value || '');
            renderFavorites();
        });
    }
}

function initFavorites() {
    favoritesStorageKey = getFavoritesStorageKey();
    loadFavoritesState();
    favoritesInitialized = true;

    populateFavoriteTeamSelect();
    bindFavoritesEvents();
    renderFavorites();

    if (isFavoritesPage()) {
        loadFavoritesInsights();
    }
}

window.NBA_TEAM_OPTIONS = NBA_TEAM_OPTIONS;
window.initFavorites = initFavorites;
window.addFavoriteTeam = addFavoriteTeam;
window.addFavoritePlayer = addFavoritePlayer;
window.isFavoriteTeam = isFavoriteTeam;
window.isFavoritePlayer = isFavoritePlayer;
window.toggleFavoriteTeam = toggleFavoriteTeam;
window.toggleFavoritePlayer = toggleFavoritePlayer;
window.addSelectedTeamFavorite = addSelectedTeamFavorite;
window.addPlayerFavoriteFromInput = addPlayerFavoriteFromInput;
window.removeFavoriteByIndex = removeFavoriteByIndex;
window.clearAllFavorites = clearAllFavorites;
