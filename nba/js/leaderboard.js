// ============================================================
// leaderboard.js — Ranking de la comunidad NBA LIVE
// ============================================================

(function () {
    const API = 'http://localhost:3000';

    const MEDALS = ['🥇', '🥈', '🥉'];

    const FRAME_STYLES = {
        'Marco Básico':   'border:3px solid #1565C0;',
        'Marco All-Star': 'border:3px solid #ffd700; box-shadow:0 0 8px #ffd70066;',
        'Marco MVP':      'border:3px solid #e53935; box-shadow:0 0 10px #e5393566;',
        'Marco Campeón':  'border:3px solid #ffd700; box-shadow:0 0 14px #ffd700aa;'
    };

    let _data = null;
    let _activeTab = 'coins';

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _frameStyle(frameName) {
        return frameName ? (FRAME_STYLES[frameName] || 'border:3px solid #444;') : 'border:3px solid #333;';
    }

    function _renderUserBadge(entry) {
        const badgeHtml = entry.badge_emoji
            ? `<span class="lb-row-badge">${_esc(entry.badge_emoji)}</span>`
            : '';
        const nameColor = entry.username_color
            ? ` style="color:${_esc(entry.username_color)}"`
            : '';
        const titleHtml = entry.active_title
            ? `<span class="lb-row-title">${_esc(entry.active_title)}</span>`
            : '';
        const roleTag = entry.role === 'admin'
            ? '<span class="lb-admin-tag">👑</span>'
            : '';
        return `${badgeHtml}<span class="lb-row-name"${nameColor}>${_esc(entry.username)}</span>${roleTag}${titleHtml}`;
    }

    function _renderPOW(entry) {
        if (!entry) return '';
        const frameStyle = _frameStyle(entry.frame_name);
        const stat = entry.total_score !== undefined
            ? `<span class="pow-stat">${entry.total_score} pts esta semana</span>`
            : `<span class="pow-stat">🪙 ${entry.coins || 0} monedas</span>`;

        return `
        <div class="pow-card">
            <div class="pow-crown">🏅 Jugador de la Semana</div>
            <div class="pow-inner">
                <div class="pow-avatar-wrap">
                    <span class="pow-avatar" style="${_esc(frameStyle)}">${_esc(entry.avatar || '🏀')}</span>
                </div>
                <div class="pow-info">
                    <div class="pow-identity">${_renderUserBadge(entry)}</div>
                    ${stat}
                </div>
            </div>
        </div>`;
    }

    function _renderRow(entry, index) {
        const rank = index + 1;
        const medal = MEDALS[index] || `<span class="lb-rank-num">${rank}</span>`;
        const frameStyle = _frameStyle(entry.frame_name);

        let statHtml = '';
        if (entry.net_winnings !== undefined) {
            statHtml = `<span class="lb-stat lb-stat--bettors">🎰 +🪙 ${entry.net_winnings} (${entry.bets_won}W)</span>`;
        } else if (entry.coins !== undefined) {
            statHtml = `<span class="lb-stat lb-stat--coins">🪙 ${entry.coins}</span>`;
        } else if (entry.review_count !== undefined) {
            statHtml = `<span class="lb-stat lb-stat--reviews">⭐ ${entry.review_count}</span>`;
        } else {
            statHtml = `<span class="lb-stat lb-stat--score">${entry.total_score} pts</span>`;
        }

        return `
        <li class="lb-row ${rank <= 3 ? 'lb-row--top' : ''}">
            <span class="lb-medal">${medal}</span>
            <span class="lb-avatar" style="${_esc(frameStyle)}">${_esc(entry.avatar || '🏀')}</span>
            <div class="lb-identity">${_renderUserBadge(entry)}</div>
            ${statHtml}
        </li>`;
    }

    function _renderList(rows, emptyMsg) {
        if (!rows || rows.length === 0) {
            return `<li class="lb-empty">${_esc(emptyMsg)}</li>`;
        }
        return rows.map((r, i) => _renderRow(r, i)).join('');
    }

    function _renderActiveTab() {
        const list = document.getElementById('lb-list');
        if (!list || !_data) return;

        let rows, empty;
        if (_activeTab === 'coins') {
            rows = _data.topCoins;
            empty = 'Sin datos de monedas aún.';
        } else if (_activeTab === 'reviews') {
            rows = _data.topReviews;
            empty = 'Nadie ha escrito reseñas todavía.';
        } else if (_activeTab === 'week') {
            rows = _data.topWeek;
            empty = 'Nadie ha jugado minijuegos esta semana.';
        } else {
            rows = _data.topBettors || [];
            empty = 'Nadie ha apostado todavía.';
        }

        list.innerHTML = _renderList(rows, empty);

        document.querySelectorAll('.lb-tab').forEach(btn => {
            btn.classList.toggle('lb-tab--active', btn.dataset.tab === _activeTab);
        });
    }

    function selectTab(tab) {
        _activeTab = tab;
        _renderActiveTab();
    }

    async function init() {
        if (!window.ensureAuthenticated || !window.ensureAuthenticated()) return;

        const powEl = document.getElementById('lb-pow');
        const listEl = document.getElementById('lb-list');

        try {
            const token = localStorage.getItem('nba_token');
            const res = await fetch(`${API}/api/leaderboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(await res.text());

            _data = await res.json();

            if (powEl) powEl.innerHTML = _renderPOW(_data.playerOfWeek);
            _renderActiveTab();
        } catch (err) {
            console.error('Error cargando leaderboard:', err);
            if (powEl) powEl.innerHTML = '<p class="lb-error">No se pudo cargar el ranking.</p>';
            if (listEl) listEl.innerHTML = '<li class="lb-empty">Error al conectar con el servidor.</li>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        window.initAuth && window.initAuth();

        document.querySelectorAll('.lb-tab').forEach(btn => {
            btn.addEventListener('click', () => selectTab(btn.dataset.tab));
        });

        init();
    });

    window.selectLbTab = selectTab;
})();
