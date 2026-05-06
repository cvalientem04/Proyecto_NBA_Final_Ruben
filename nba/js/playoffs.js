// ============================================================
// playoffs.js - Cuadro Playoffs con resultados reales de API
// Consume /api/playoffs/bracket y NO proyecta ganadores.
// ============================================================

const TEAM_COLOR_MAP = {
    ATL: ['#E03A3E', '#C1D32F'],
    BOS: ['#007A33', '#BA9653'],
    BKN: ['#202225', '#D4D7DC'],
    CHA: ['#1D1160', '#00A4BD'],
    CHI: ['#CE1141', '#111111'],
    CLE: ['#860038', '#FDBB30'],
    DAL: ['#00538C', '#B8C4CA'],
    DEN: ['#0E2240', '#FEC524'],
    DET: ['#C8102E', '#1D42BA'],
    GSW: ['#1D428A', '#FFC72C'],
    HOU: ['#CE1141', '#111111'],
    IND: ['#002D62', '#FDBB30'],
    LAC: ['#C8102E', '#1D428A'],
    LAL: ['#552583', '#FDB927'],
    MEM: ['#5D76A9', '#12173F'],
    MIA: ['#98002E', '#F9A01B'],
    MIL: ['#00471B', '#EEE1C6'],
    MIN: ['#0C2340', '#236192'],
    NOP: ['#0C2340', '#C8102E'],
    NYK: ['#006BB6', '#F58426'],
    OKC: ['#007AC1', '#EF3B24'],
    ORL: ['#0077C0', '#C4CED4'],
    PHI: ['#006BB6', '#ED174C'],
    PHX: ['#1D1160', '#E56020'],
    POR: ['#E03A3E', '#111111'],
    SAC: ['#5A2D81', '#63727A'],
    SAS: ['#747A85', '#111111'],
    TOR: ['#CE1141', '#111111'],
    UTA: ['#002B5C', '#00471B'],
    WAS: ['#002B5C', '#E31837']
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAbbr(value) {
    const raw = String(value || '').trim().toUpperCase();

    if (typeof toNbaAbbr === 'function') {
        return toNbaAbbr(raw);
    }

    const fallbackMap = {
        WSH: 'WAS',
        NY: 'NYK',
        GS: 'GSW',
        SA: 'SAS',
        NO: 'NOP',
        UTAH: 'UTA'
    };

    return fallbackMap[raw] || raw;
}

function getTeamColors(team) {
    const palette = TEAM_COLOR_MAP[normalizeAbbr(team?.abbr)] || ['#3A3F51', '#9AA1B8'];

    return {
        main: palette[0],
        accent: palette[1]
    };
}

function normalizeTeam(team) {
    if (!team || typeof team !== 'object') return null;

    const name = String(team.name || '').trim();
    const abbr = normalizeAbbr(team.abbr || 'NBA');

    if (!name && !abbr) return null;

    return {
        teamId: team.teamId || null,
        name: name || 'Equipo NBA',
        abbr,
        seed: toNumberOrNull(team.seed),
        wins: toNumberOrNull(team.wins),
        losses: toNumberOrNull(team.losses),
        logo: String(team.logo || '').trim()
    };
}

function normalizeSeries(rawSeries, fallbackSlotLabel) {
    const teamA = normalizeTeam(rawSeries?.teamA);
    const teamB = normalizeTeam(rawSeries?.teamB);
    const winner = normalizeTeam(rawSeries?.winner);

    return {
        slot: fallbackSlotLabel,
        label: String(rawSeries?.label || ''),
        teamA,
        teamB,
        teamAWins: toNumberOrNull(rawSeries?.teamAWins),
        teamBWins: toNumberOrNull(rawSeries?.teamBWins),
        isFinished: Boolean(rawSeries?.isFinished),
        winner,
        latestGameDate: String(rawSeries?.latestGameDate || '')
    };
}

function sortSeriesBySeed(seriesList) {
    return [...seriesList].sort((seriesA, seriesB) => {
        const seedA = toNumberOrNull(seriesA?.teamA?.seed) ?? 99;
        const seedB = toNumberOrNull(seriesB?.teamA?.seed) ?? 99;

        if (seedA !== seedB) return seedA - seedB;

        const teamAAbbr = String(seriesA?.teamA?.abbr || '');
        const teamBAbbr = String(seriesB?.teamA?.abbr || '');
        return teamAAbbr.localeCompare(teamBAbbr);
    });
}

function getRoundSeries(payload, roundKey, conferenceKey) {
    const list = payload?.rounds?.[roundKey]?.[conferenceKey];
    return Array.isArray(list) ? list : [];
}

function buildSeriesSlots(rawSeriesList, slotLabels) {
    const normalized = sortSeriesBySeed(rawSeriesList.map((series, index) => normalizeSeries(series, slotLabels[index] || `Serie ${index + 1}`)));

    const slots = [];

    for (let index = 0; index < slotLabels.length; index += 1) {
        if (normalized[index]) {
            slots.push({
                ...normalized[index],
                slot: slotLabels[index]
            });
            continue;
        }

        slots.push({
            slot: slotLabels[index],
            label: '',
            teamA: null,
            teamB: null,
            teamAWins: null,
            teamBWins: null,
            isFinished: false,
            winner: null,
            latestGameDate: ''
        });
    }

    return slots;
}

function buildConferenceState(payload, conferenceKey) {
    return {
        round1: buildSeriesSlots(getRoundSeries(payload, 'first_round', conferenceKey), ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 4']),
        round2: buildSeriesSlots(getRoundSeries(payload, 'semifinals', conferenceKey), ['Semifinal A', 'Semifinal B']),
        round3: buildSeriesSlots(getRoundSeries(payload, 'conference_finals', conferenceKey), ['Final Conferencia'])
    };
}

function getConferenceWinner(conferenceState) {
    const conferenceFinal = conferenceState?.round3?.[0];

    if (!conferenceFinal || !conferenceFinal.isFinished || !conferenceFinal.winner) {
        return null;
    }

    return conferenceFinal.winner;
}

function getNbaFinalSeries(payload) {
    const finals = getRoundSeries(payload, 'nba_finals', 'nba');
    if (!Array.isArray(finals) || finals.length === 0) return null;

    return normalizeSeries(finals[0], 'NBA Finals');
}

function renderTeamBadge(team, side) {
    if (!team) {
        return `
            <div class="playoff-team-badge placeholder ${side}">
                <span class="playoff-badge-abbr">TBD</span>
            </div>
        `;
    }

    const palette = getTeamColors(team);
    const badgeStyle = `--team-main:${palette.main};--team-accent:${palette.accent};`;

    return `
        <div class="playoff-team-badge ${side}" style="${badgeStyle}">
            <span class="playoff-badge-seed">${team.seed !== null ? `#${team.seed}` : '-'}</span>
            ${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)}" class="playoff-badge-logo">` : ''}
            <span class="playoff-badge-abbr">${escapeHtml(team.abbr)}</span>
        </div>
    `;
}

function renderSeriesBox(series, side, slotClass, connectClass) {
    const hasScore = series.teamAWins !== null && series.teamBWins !== null;
    const hasGamesPlayed = hasScore && (series.teamAWins > 0 || series.teamBWins > 0);
    const stateLabel = series.isFinished ? 'Cerrada' : hasGamesPlayed ? 'En juego' : 'Pendiente';
    const stateCls = series.isFinished ? 'state-closed' : hasGamesPlayed ? 'state-active' : 'state-pending';

    const abbrA = escapeHtml(series.teamA?.abbr || 'A');
    const abbrB = escapeHtml(series.teamB?.abbr || 'B');
    const scoreText = hasScore
        ? `${abbrA} ${series.teamAWins} – ${series.teamBWins} ${abbrB}`
        : '--';

    return `
        <article class="playoff-series-box ${side} ${slotClass} ${connectClass}">
            <p class="playoff-series-label">${escapeHtml(series.slot)}</p>
            <div class="playoff-series-teams">
                ${renderTeamBadge(series.teamA, side)}
                ${renderTeamBadge(series.teamB, side)}
            </div>
            <div class="playoff-series-meta">
                <span class="playoff-series-state ${stateCls}">${stateLabel}</span>
                <span class="playoff-series-score">${scoreText}</span>
            </div>
        </article>
    `;
}

function renderConferenceGrid(side, title, conferenceState) {
    const round1Markup = conferenceState.round1
        .map((series, index) => renderSeriesBox(series, side, `slot-r1-${index + 1}`, 'connect-next'))
        .join('');

    const round2Markup = conferenceState.round2
        .map((series, index) => renderSeriesBox(series, side, `slot-r2-${index + 1}`, 'connect-next'))
        .join('');

    const round3Markup = renderSeriesBox(conferenceState.round3[0], side, 'slot-r3-1', 'connect-finals');

    return `
        <section class="playoff-conference ${side}">
            <h3>${escapeHtml(title)}</h3>
            <div class="playoff-conference-grid ${side}">
                ${round1Markup}
                ${round2Markup}
                ${round3Markup}
            </div>
        </section>
    `;
}

function renderFinalsCore(payload, westState, eastState) {
    const nbaFinalSeries = getNbaFinalSeries(payload);

    const westFinalist = nbaFinalSeries?.teamA || getConferenceWinner(westState);
    const eastFinalist = nbaFinalSeries?.teamB || getConferenceWinner(eastState);

    const finalsScoreText = nbaFinalSeries && nbaFinalSeries.teamAWins !== null && nbaFinalSeries.teamBWins !== null
        ? `${nbaFinalSeries.teamAWins}-${nbaFinalSeries.teamBWins}`
        : '--';

    const isFinished = nbaFinalSeries?.isFinished && nbaFinalSeries?.winner;

    return `
        <section class="playoff-finals-core">
            <p class="playoff-core-title">NBA Finals</p>
            <div class="playoff-finals-series">
                ${renderTeamBadge(westFinalist, 'west')}
                ${renderTeamBadge(eastFinalist, 'east')}
            </div>
            <p class="playoff-series-score finals">Serie: ${escapeHtml(finalsScoreText)}</p>
            ${isFinished ? `
            <div class="playoff-champion-card">
                <strong>🏆 ${escapeHtml(nbaFinalSeries.winner.name)}</strong>
                <span>${escapeHtml(nbaFinalSeries.winner.abbr)}</span>
            </div>` : ''}
        </section>
    `;
}

function renderPlayoffsContent(payload) {
    const westState = buildConferenceState(payload, 'west');
    const eastState = buildConferenceState(payload, 'east');

    return `
        <div class="playoff-board-shell">
            <div class="playoff-board">
                <header class="playoff-board-header">
                    <span class="playoff-board-title west">Western Conference</span>
                    <span class="playoff-board-title east">Eastern Conference</span>
                </header>

                <div class="playoff-board-body">
                    ${renderConferenceGrid('west', 'Rondas oficiales', westState)}
                    ${renderFinalsCore(payload, westState, eastState)}
                    ${renderConferenceGrid('east', 'Rondas oficiales', eastState)}
                </div>
            </div>
        </div>
    `;
}

function formatTimestampLabel() {
    const now = new Date();
    return now.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadPlayoffs() {
    const contentContainer = document.getElementById('playoffs-content');
    const updateLabel = document.getElementById('playoffs-last-update');

    if (!contentContainer) return;

    contentContainer.innerHTML = '<div class="loading">Cargando resultados reales de Playoffs...</div>';
    if (updateLabel) {
        updateLabel.textContent = 'Consultando API de Playoffs...';
    }

    try {
        const response = await fetch(`${API_SERVER}/api/playoffs/bracket`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json();
        const hasRounds = payload && payload.rounds && typeof payload.rounds === 'object';

        if (!hasRounds) {
            throw new Error('La API no devolvio un bracket valido.');
        }

        contentContainer.innerHTML = renderPlayoffsContent(payload);

        if (updateLabel) {
            updateLabel.textContent = `Ultima actualizacion: ${formatTimestampLabel()} | Fuente: ${payload.source || 'API'}`;
        }
    } catch (error) {
        console.error('Error cargando playoffs:', error);
        contentContainer.innerHTML = `
            <div class="error-message">
                <h3>Error al cargar Playoffs reales</h3>
                <p>${escapeHtml(error.message)}</p>
                <p style="margin-top: 8px; color: #7f879b;">Si acabas de actualizar el servidor, reinicia Node para activar el endpoint nuevo.</p>
            </div>
        `;

        if (updateLabel) {
            updateLabel.textContent = 'No se pudo actualizar el bracket en este momento.';
        }
    }
}

window.loadPlayoffs = loadPlayoffs;
