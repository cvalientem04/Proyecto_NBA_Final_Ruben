// ============================================================
// bets.js — Sistema de apuestas NBA LIVE
// ============================================================

(function () {
    const API = 'http://localhost:3000';

    let _allEvents  = [];
    let _activeTab  = 'open';
    let _betEventId = null;
    let _betChoice  = null;

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _authHeader() {
        const token = localStorage.getItem('nba_token');
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    }

    function _fmtDate(val) {
        if (!val) return '—';
        return new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ── Status badges ──────────────────────────────────────
    function _statusBadge(status) {
        const map = {
            open:      '<span class="bets-status bets-status--open">🟢 Abierta</span>',
            closed:    '<span class="bets-status bets-status--closed">🔒 Cerrada</span>',
            resolved:  '<span class="bets-status bets-status--resolved">🏁 Resuelta</span>',
            cancelled: '<span class="bets-status bets-status--cancelled">❌ Cancelada</span>'
        };
        return map[status] || status;
    }

    function _betStatusBadge(status) {
        const map = {
            pending:  '<span class="bets-result bets-result--pending">⏳ Pendiente</span>',
            won:      '<span class="bets-result bets-result--won">🏆 Ganada</span>',
            lost:     '<span class="bets-result bets-result--lost">💸 Perdida</span>',
            refunded: '<span class="bets-result bets-result--refunded">↩️ Devuelta</span>'
        };
        return map[status] || status;
    }

    // ── Render event card ───────────────────────────────────
    function _renderEventCard(ev, myBetOnThis) {
        const poolA  = ev.pool_team_a || 0;
        const poolB  = ev.pool_team_b || 0;
        const total  = ev.total_pool || 0;
        const pctA   = total > 0 ? Math.round(poolA / total * 100) : 50;
        const pctB   = 100 - pctA;

        const winnerLine = ev.status === 'resolved' && ev.winner
            ? `<p class="bets-winner-line">🏆 Ganador: <strong>${_esc(ev.winner === 'team_a' ? ev.team_a : ev.winner === 'team_b' ? ev.team_b : 'Empate')}</strong></p>`
            : '';

        let actionHtml = '';
        if (ev.status === 'open') {
            if (myBetOnThis) {
                const choiceName = myBetOnThis.team_choice === 'team_a' ? ev.team_a : ev.team_b;
                actionHtml = `<p class="bets-already">✅ Ya apostaste 🪙 ${myBetOnThis.amount} a <strong>${_esc(choiceName)}</strong></p>`;
            } else {
                actionHtml = `<button class="bets-place-btn" onclick="openBetModal(${ev.id})">🎰 Apostar</button>`;
            }
        }

        return `
        <article class="bets-event-card">
            <div class="bets-event-header">
                <span class="bets-event-title">${_esc(ev.title)}</span>
                ${_statusBadge(ev.status)}
            </div>
            ${ev.description ? `<p class="bets-event-desc">${_esc(ev.description)}</p>` : ''}
            <div class="bets-teams">
                <span class="bets-team-name">${_esc(ev.team_a)}</span>
                <span class="bets-vs-sm">VS</span>
                <span class="bets-team-name">${_esc(ev.team_b)}</span>
            </div>
            ${winnerLine}
            <div class="bets-pool-bar" title="${pctA}% ${ev.team_a} — ${pctB}% ${ev.team_b}">
                <div class="bets-pool-a" style="width:${pctA}%"></div>
                <div class="bets-pool-b" style="width:${pctB}%"></div>
            </div>
            <div class="bets-pool-labels">
                <span>${_esc(ev.team_a)} ${pctA}% (🪙 ${poolA})</span>
                <span>${ev.total_bets || 0} apuestas · 🪙 ${total} en juego</span>
                <span>${pctB}% ${_esc(ev.team_b)} (🪙 ${poolB})</span>
            </div>
            <div class="bets-event-footer">
                ${ev.closes_at ? `<span class="bets-closes">Cierra: ${_fmtDate(ev.closes_at)}</span>` : ''}
                ${actionHtml}
            </div>
        </article>`;
    }

    // ── Render my bet row ───────────────────────────────────
    function _renderMyBet(bet) {
        const choiceName = bet.team_choice === 'team_a' ? bet.team_a : bet.team_b;
        const payoutLine = bet.status === 'won'
            ? `<span class="bets-payout">+🪙 ${bet.payout} recibidos</span>`
            : bet.status === 'refunded'
            ? `<span class="bets-payout bets-payout--refund">↩️ ${bet.payout} devueltos</span>`
            : bet.status === 'lost'
            ? `<span class="bets-payout bets-payout--lost">-🪙 ${bet.amount}</span>`
            : '';

        return `
        <li class="bets-mine-row">
            <div class="bets-mine-info">
                <span class="bets-mine-event">${_esc(bet.title)}</span>
                <span class="bets-mine-choice">Apuestaste a: <strong>${_esc(choiceName)}</strong> · 🪙 ${bet.amount}</span>
                <span class="bets-mine-date">${_fmtDate(bet.created_at)}</span>
            </div>
            <div class="bets-mine-right">
                ${_betStatusBadge(bet.status)}
                ${payoutLine}
            </div>
        </li>`;
    }

    // ── Sync coins from server ──────────────────────────────
    async function refreshUserCoins() {
        try {
            const res = await fetch(`${API}/api/profile`, { headers: _authHeader() });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.user) return;
            const userRaw = localStorage.getItem('nba_user');
            if (userRaw) {
                const user = JSON.parse(userRaw);
                user.coins = data.user.coins;
                localStorage.setItem('nba_user', JSON.stringify(user));
            }
            const coinsEl = document.getElementById('userCoins');
            if (coinsEl) coinsEl.textContent = `🪙 ${data.user.coins}`;
        } catch (_) {}
    }

    // ── Load & render ───────────────────────────────────────
    async function loadEvents() {
        try {
            const res = await fetch(`${API}/api/bets/events`, { headers: _authHeader() });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            _allEvents = data.events || [];
            _renderCurrentTab();
        } catch (err) {
            console.error('Error cargando eventos:', err);
            document.getElementById('bets-open-list').innerHTML =
                '<p class="bets-empty">No se pudo conectar con el servidor.</p>';
        }
    }

    async function loadMyBets() {
        const el = document.getElementById('bets-mine-list');
        if (!el) return;
        try {
            const res = await fetch(`${API}/api/bets/my-bets`, { headers: _authHeader() });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const bets = data.bets || [];
            if (bets.length === 0) {
                el.innerHTML = '<p class="bets-empty">Todavía no has hecho ninguna apuesta.</p>';
            } else {
                el.innerHTML = `<ul class="bets-mine-ul">${bets.map(_renderMyBet).join('')}</ul>`;
            }
        } catch (err) {
            el.innerHTML = '<p class="bets-empty">Error al cargar tus apuestas.</p>';
        }
    }

    function _renderCurrentTab() {
        const openEl     = document.getElementById('bets-open-list');
        const resolvedEl = document.getElementById('bets-resolved-list');

        const user = window.getCurrentUserFromStorage && window.getCurrentUserFromStorage();
        const myBetsMap = {};

        const open     = _allEvents.filter(e => e.status === 'open');
        const closed   = _allEvents.filter(e => e.status === 'closed');
        const resolved = _allEvents.filter(e => e.status === 'resolved' || e.status === 'cancelled');

        if (openEl) {
            const visible = [...open, ...closed];
            if (visible.length === 0) {
                openEl.innerHTML = '<p class="bets-empty">No hay eventos de apuestas abiertos ahora mismo.</p>';
            } else {
                openEl.innerHTML = visible.map(ev => _renderEventCard(ev, myBetsMap[ev.id])).join('');
            }
        }
        if (resolvedEl) {
            if (resolved.length === 0) {
                resolvedEl.innerHTML = '<p class="bets-empty">No hay eventos resueltos aún.</p>';
            } else {
                resolvedEl.innerHTML = resolved.map(ev => _renderEventCard(ev, null)).join('');
            }
        }
    }

    // ── Tabs ────────────────────────────────────────────────
    function switchBetsTab(tab) {
        _activeTab = tab;
        document.querySelectorAll('.bets-tab').forEach(btn => {
            btn.classList.toggle('bets-tab--active', btn.dataset.tab === tab);
        });
        ['open', 'mine', 'resolved'].forEach(t => {
            const el = document.getElementById(`bets-tab-${t}`);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
        if (tab === 'mine') { refreshUserCoins(); loadMyBets(); }
    }

    // ── Bet modal ───────────────────────────────────────────
    function openBetModal(eventId) {
        const ev = _allEvents.find(e => e.id === eventId);
        if (!ev) return;
        _betEventId = eventId;
        _betChoice  = null;

        document.getElementById('betModalTitle').textContent = '🎰 Apostar en: ' + ev.title;
        document.getElementById('betModalEvent').textContent = ev.description || '';
        document.getElementById('betChoiceA').textContent = ev.team_a;
        document.getElementById('betChoiceB').textContent = ev.team_b;
        document.getElementById('betChoiceA').classList.remove('selected');
        document.getElementById('betChoiceB').classList.remove('selected');
        document.getElementById('betAmount').value = '';
        document.getElementById('betModalFeedback').textContent = '';
        document.getElementById('betModal').style.display = 'flex';
    }

    function closeBetModal() {
        document.getElementById('betModal').style.display = 'none';
        _betEventId = null;
        _betChoice  = null;
    }

    function selectBetChoice(choice) {
        _betChoice = choice;
        document.getElementById('betChoiceA').classList.toggle('selected', choice === 'team_a');
        document.getElementById('betChoiceB').classList.toggle('selected', choice === 'team_b');
    }

    function setBetAmount(val) {
        document.getElementById('betAmount').value = val;
    }

    async function confirmBet() {
        const feedback = document.getElementById('betModalFeedback');
        if (!_betChoice) {
            feedback.textContent = 'Elige un equipo primero.';
            return;
        }
        const amount = Number(document.getElementById('betAmount').value);
        if (!amount || amount < 10) {
            feedback.textContent = 'La apuesta mínima es 🪙 10 monedas.';
            return;
        }

        feedback.textContent = 'Procesando...';
        try {
            const res = await fetch(`${API}/api/bets/place`, {
                method: 'POST',
                headers: _authHeader(),
                body: JSON.stringify({ event_id: _betEventId, team_choice: _betChoice, amount })
            });
            const data = await res.json();
            if (!res.ok) {
                feedback.textContent = data.error || 'Error al apostar.';
                return;
            }

            // Actualizar monedas en localStorage y header
            try {
                const userRaw = localStorage.getItem('nba_user');
                if (userRaw) {
                    const user = JSON.parse(userRaw);
                    user.coins = data.coins;
                    localStorage.setItem('nba_user', JSON.stringify(user));
                    const coinsEl = document.getElementById('userCoins');
                    if (coinsEl) coinsEl.textContent = `🪙 ${data.coins}`;
                }
            } catch (_) {}

            closeBetModal();
            await loadEvents();
        } catch (err) {
            feedback.textContent = 'Error de conexión.';
        }
    }

    // ── Init ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        window.initAuth && window.initAuth();
        refreshUserCoins();
        loadEvents();

        const modal = document.getElementById('betModal');
        if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeBetModal(); });
    });

    window.switchBetsTab  = switchBetsTab;
    window.openBetModal   = openBetModal;
    window.closeBetModal  = closeBetModal;
    window.selectBetChoice = selectBetChoice;
    window.setBetAmount   = setBetAmount;
    window.confirmBet     = confirmBet;
})();
