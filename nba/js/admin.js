// ============================================================
// admin.js - Panel de administración NBA LIVE
// Solo accesible para usuarios con role === 'admin'
// ============================================================

const ADMIN_API = 'http://localhost:3000';

let allUsers = [];
let coinsTargetUserId = null;
let coinsTargetUsername = '';

function ensureAdmin() {
    if (typeof window.isAdmin !== 'function' || !window.isAdmin()) {
        window.location.href = 'nba.html';
        return false;
    }
    return true;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getAuthHeader() {
    const token = localStorage.getItem('nba_token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ===== STATS GLOBALES =====
async function loadAdminStats() {
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/stats`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Error al cargar stats');
        const data = await res.json();

        const el = id => document.getElementById(id);
        if (el('stat-users')) el('stat-users').textContent = data.totalUsers ?? '—';
        if (el('stat-reviews')) el('stat-reviews').textContent = data.totalReviews ?? '—';
        if (el('stat-fav-team')) {
            el('stat-fav-team').textContent = data.mostFavoriteTeam
                ? `${data.mostFavoriteTeam.team_name} (${data.mostFavoriteTeam.count})`
                : 'Sin datos';
        }
        if (el('stat-top-game')) {
            el('stat-top-game').textContent = data.mostPlayedGame
                ? `${data.mostPlayedGame.game_type} (${data.mostPlayedGame.count})`
                : 'Sin datos';
        }
    } catch (err) {
        console.error('Error loadAdminStats:', err);
    }
}

// ===== USUARIOS =====
async function loadAdminUsers() {
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/users`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Error al cargar usuarios');
        const data = await res.json();
        allUsers = data.users || [];
        renderUsersTable(allUsers);
    } catch (err) {
        console.error('Error loadAdminUsers:', err);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="admin-loading" style="color:#e03a3e">Error al cargar usuarios.</td></tr>';
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    const label = document.getElementById('usersCountLabel');
    if (!tbody) return;

    if (label) label.textContent = `${users.length} usuario${users.length !== 1 ? 's' : ''}`;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">No hay usuarios.</td></tr>';
        return;
    }

    const currentUserId = window.getCurrentUserFromStorage?.()?.id;

    tbody.innerHTML = users.map(u => {
        const isSelf = u.id === currentUserId;
        const bannedClass = u.banned ? 'admin-badge admin-badge--banned' : 'admin-badge admin-badge--active';
        const bannedLabel = u.banned ? 'Baneado' : 'Activo';
        const roleClass = u.role === 'admin' ? 'admin-badge admin-badge--admin' : 'admin-badge admin-badge--user';

        return `<tr class="${u.banned ? 'admin-row--banned' : ''}">
            <td><strong>${escapeHtml(u.username)}</strong></td>
            <td class="admin-td--email">${escapeHtml(u.email)}</td>
            <td>🪙 ${u.coins ?? 0}</td>
            <td><span class="${roleClass}">${u.role === 'admin' ? '👑 Admin' : '👤 Usuario'}</span></td>
            <td><span class="${bannedClass}">${bannedLabel}</span></td>
            <td>${formatDate(u.created_at)}</td>
            <td class="admin-actions-cell">
                ${isSelf ? '<span class="admin-td--muted">(Tú)</span>' : `
                <button class="admin-btn admin-btn--coins" onclick="openCoinsModal(${u.id}, '${escapeHtml(u.username)}')" title="Modificar monedas">🪙 Monedas</button>
                ${u.banned
                    ? `<button class="admin-btn admin-btn--unban" onclick="toggleBan(${u.id}, false, this)">✅ Desbanear</button>`
                    : `<button class="admin-btn admin-btn--ban" onclick="toggleBan(${u.id}, true, this)">🚫 Banear</button>`
                }
                `}
            </td>
        </tr>`;
    }).join('');
}

function filterUsers() {
    const query = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    if (!query) {
        renderUsersTable(allUsers);
        return;
    }
    const filtered = allUsers.filter(u =>
        u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
    );
    renderUsersTable(filtered);
}

async function toggleBan(userId, banned, btn) {
    const action = banned ? 'banear' : 'desbanear';
    if (!confirm(`¿Seguro que quieres ${action} a este usuario?`)) return;

    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${ADMIN_API}/api/admin/users/${userId}/ban`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify({ banned })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        // Actualizar en local y re-renderizar
        const user = allUsers.find(u => u.id === userId);
        if (user) user.banned = banned;
        filterUsers();
    } catch (err) {
        alert(`Error: ${err.message}`);
        if (btn) btn.disabled = false;
    }
}

// ===== MODAL MONEDAS =====
function openCoinsModal(userId, username) {
    coinsTargetUserId = userId;
    coinsTargetUsername = username;
    const subtitle = document.getElementById('coinsModalUser');
    if (subtitle) subtitle.textContent = `Usuario: ${username}`;
    const amountInput = document.getElementById('coinsAmount');
    if (amountInput) amountInput.value = '';
    const feedback = document.getElementById('coinsModalFeedback');
    if (feedback) { feedback.textContent = ''; feedback.className = 'admin-modal-feedback'; }
    const modal = document.getElementById('coinsModal');
    if (modal) modal.style.display = 'flex';
}

function closeCoinsModal() {
    coinsTargetUserId = null;
    const modal = document.getElementById('coinsModal');
    if (modal) modal.style.display = 'none';
}

async function submitCoins() {
    const amount = parseInt(document.getElementById('coinsAmount')?.value, 10);
    const feedback = document.getElementById('coinsModalFeedback');

    if (isNaN(amount) || amount === 0) {
        if (feedback) { feedback.textContent = 'Introduce un número válido distinto de 0.'; feedback.className = 'admin-modal-feedback error'; }
        return;
    }

    try {
        const res = await fetch(`${ADMIN_API}/api/admin/users/${coinsTargetUserId}/coins`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');

        // Actualizar en local
        const user = allUsers.find(u => u.id === coinsTargetUserId);
        if (user) user.coins = data.coins;
        filterUsers();

        if (feedback) {
            feedback.textContent = `✅ ${data.message} Nuevo total: 🪙 ${data.coins}`;
            feedback.className = 'admin-modal-feedback success';
        }
        setTimeout(closeCoinsModal, 1500);
    } catch (err) {
        if (feedback) { feedback.textContent = `Error: ${err.message}`; feedback.className = 'admin-modal-feedback error'; }
    }
}

// ===== RESEÑAS =====
async function loadAdminReviews() {
    const container = document.getElementById('adminReviewsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API}/api/reviews`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Error al cargar reseñas');
        const data = await res.json();
        const reviews = data.reviews || [];

        const label = document.getElementById('reviewsCountLabel');
        if (label) label.textContent = `${reviews.length} reseña${reviews.length !== 1 ? 's' : ''}`;

        if (reviews.length === 0) {
            container.innerHTML = '<p class="admin-loading">No hay reseñas.</p>';
            return;
        }

        container.innerHTML = reviews.map(r => `
            <div class="admin-review-card" data-review-id="${r.id}">
                <div class="admin-review-top">
                    <strong>${escapeHtml(r.name)}</strong>
                    <span class="admin-review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    <span class="admin-review-date">${formatDate(r.created_at)}</span>
                    <button class="admin-btn admin-btn--danger" onclick="adminDeleteReview(${r.id})">🗑️ Eliminar</button>
                </div>
                <p class="admin-review-comment">${escapeHtml(r.comment)}</p>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p class="admin-loading" style="color:#e03a3e">Error al cargar reseñas.</p>';
    }
}

async function adminDeleteReview(id) {
    if (!confirm('¿Eliminar esta reseña definitivamente?')) return;
    try {
        const res = await fetch(`${ADMIN_API}/api/reviews/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        const card = document.querySelector(`.admin-review-card[data-review-id="${id}"]`);
        if (card) card.remove();
        // Actualizar contador
        const label = document.getElementById('reviewsCountLabel');
        if (label) {
            const remaining = document.querySelectorAll('.admin-review-card').length;
            label.textContent = `${remaining} reseña${remaining !== 1 ? 's' : ''}`;
        }
        // Actualizar stat
        const statEl = document.getElementById('stat-reviews');
        if (statEl) statEl.textContent = Math.max(0, parseInt(statEl.textContent, 10) - 1);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}
window.adminDeleteReview = adminDeleteReview;

// ===== TABS =====
function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));

    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) tabContent.style.display = '';
    const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}
window.switchAdminTab = switchAdminTab;
window.filterUsers = filterUsers;
window.toggleBan = toggleBan;
window.openCoinsModal = openCoinsModal;
window.closeCoinsModal = closeCoinsModal;
window.submitCoins = submitCoins;

// Cerrar modal haciendo clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('coinsModal');
    if (modal && e.target === modal) closeCoinsModal();
});

// ===== TIENDA: ITEMS =====
let allShopItems = [];
let editingItemId = null;

async function loadShopItems() {
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/shop/items`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        allShopItems = data.items || [];
        renderShopItemsTable(allShopItems);
    } catch (err) {
        const tbody = document.getElementById('shopItemsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="admin-loading" style="color:#e03a3e">Error al cargar items.</td></tr>';
    }
}

function renderShopItemsTable(items) {
    const tbody = document.getElementById('shopItemsTableBody');
    const label = document.getElementById('shopItemsCountLabel');
    if (!tbody) return;
    if (label) label.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">No hay items. Crea el primero.</td></tr>';
        return;
    }
    const typeLabels = { badge: 'Insignia', color: 'Color', frame: 'Marco', title: 'Título' };
    tbody.innerHTML = items.map(item => `<tr>
        <td style="font-size:22px;text-align:center">${escapeHtml(item.icon_emoji || '—')}</td>
        <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.color_hex ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${escapeHtml(item.color_hex)};vertical-align:middle;margin-left:6px"></span>` : ''}
        </td>
        <td><span class="admin-type-badge admin-type--${escapeHtml(item.type)}">${typeLabels[item.type] || item.type}</span></td>
        <td>🪙 ${Number(item.price).toLocaleString()}</td>
        <td><span class="admin-badge ${item.is_active ? 'admin-badge--active' : 'admin-badge--banned'}">${item.is_active ? 'Activo' : 'Inactivo'}</span></td>
        <td class="admin-actions-cell">
            <button class="admin-btn admin-btn--coins" onclick="openEditItemModal(${item.id})">✏️ Editar</button>
            <button class="admin-btn ${item.is_active ? 'admin-btn--ban' : 'admin-btn--unban'}" onclick="toggleItemActive(${item.id}, ${!item.is_active})">${item.is_active ? '🔒 Desactivar' : '✅ Activar'}</button>
            <button class="admin-btn admin-btn--ban" onclick="deleteShopItem(${item.id})">🗑️ Eliminar</button>
        </td>
    </tr>`).join('');
}

function onItemTypeChange() {
    const type = document.getElementById('itemType')?.value;
    const field = document.getElementById('colorHexField');
    if (field) field.style.display = type === 'color' ? '' : 'none';
}

function openCreateItemModal() {
    editingItemId = null;
    const t = document.getElementById('shopItemModalTitle');
    if (t) t.textContent = '🛍️ Crear Item';
    ['itemName', 'itemDescription', 'itemPrice', 'itemEmoji', 'itemColorHex'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const typeEl = document.getElementById('itemType');
    if (typeEl) typeEl.value = 'badge';
    onItemTypeChange();
    const fb = document.getElementById('shopItemModalFeedback');
    if (fb) { fb.textContent = ''; fb.className = 'admin-modal-feedback'; }
    const modal = document.getElementById('shopItemModal');
    if (modal) modal.style.display = 'flex';
}

function openEditItemModal(id) {
    const item = allShopItems.find(i => i.id === id);
    if (!item) return;
    editingItemId = id;
    const t = document.getElementById('shopItemModalTitle');
    if (t) t.textContent = '✏️ Editar Item';
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
    set('itemName', item.name);
    set('itemDescription', item.description);
    set('itemPrice', item.price);
    set('itemEmoji', item.icon_emoji);
    set('itemColorHex', item.color_hex || '');
    const typeEl = document.getElementById('itemType');
    if (typeEl) typeEl.value = item.type;
    onItemTypeChange();
    const fb = document.getElementById('shopItemModalFeedback');
    if (fb) { fb.textContent = ''; fb.className = 'admin-modal-feedback'; }
    const modal = document.getElementById('shopItemModal');
    if (modal) modal.style.display = 'flex';
}

function closeShopItemModal() {
    editingItemId = null;
    const modal = document.getElementById('shopItemModal');
    if (modal) modal.style.display = 'none';
}

async function submitShopItem() {
    const name = document.getElementById('itemName')?.value?.trim();
    const description = document.getElementById('itemDescription')?.value?.trim() || '';
    const type = document.getElementById('itemType')?.value;
    const price = parseInt(document.getElementById('itemPrice')?.value || '0', 10);
    const icon_emoji = document.getElementById('itemEmoji')?.value?.trim() || '';
    const color_hex = document.getElementById('itemColorHex')?.value?.trim() || null;
    const fb = document.getElementById('shopItemModalFeedback');

    if (!name || !type || isNaN(price) || price < 0) {
        if (fb) { fb.textContent = 'Nombre, tipo y precio son obligatorios.'; fb.className = 'admin-modal-feedback error'; }
        return;
    }
    try {
        const url = editingItemId
            ? `${ADMIN_API}/api/admin/shop/items/${editingItemId}`
            : `${ADMIN_API}/api/admin/shop/items`;
        const res = await fetch(url, {
            method: editingItemId ? 'PATCH' : 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ name, description, type, price, icon_emoji, color_hex })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        await loadShopItems();
        closeShopItemModal();
    } catch (err) {
        if (fb) { fb.textContent = `Error: ${err.message}`; fb.className = 'admin-modal-feedback error'; }
    }
}

async function toggleItemActive(id, active) {
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/shop/items/${id}`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify({ is_active: active })
        });
        if (!res.ok) throw new Error('Error');
        const item = allShopItems.find(i => i.id === id);
        if (item) item.is_active = active;
        renderShopItemsTable(allShopItems);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

async function deleteShopItem(id) {
    if (!confirm('¿Eliminar este item de la tienda? Los usuarios que lo tienen no lo perderán.')) return;
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/shop/items/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (!res.ok) throw new Error('Error');
        allShopItems = allShopItems.filter(i => i.id !== id);
        renderShopItemsTable(allShopItems);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ===== TÍTULOS PERSONALIZADOS =====
let allTitleRequests = [];
let currentTitleFilter = 'pending';

async function loadTitleRequests() {
    const container = document.getElementById('titleRequestsList');
    if (!container) return;
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/title-requests`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        allTitleRequests = data.requests || [];
        filterTitleRequests(currentTitleFilter);
    } catch (err) {
        if (container) container.innerHTML = '<p class="admin-loading" style="color:#e03a3e">Error al cargar solicitudes.</p>';
    }
}

function filterTitleRequests(status) {
    currentTitleFilter = status;
    document.querySelectorAll('[id^="filter-btn-"]').forEach(btn => {
        btn.className = 'admin-btn admin-btn--ghost';
    });
    const activeBtn = document.getElementById(`filter-btn-${status}`);
    if (activeBtn) activeBtn.className = 'admin-btn admin-btn--primary';

    const filtered = status === 'all' ? allTitleRequests : allTitleRequests.filter(r => r.status === status);
    const label = document.getElementById('titleRequestsCountLabel');
    if (label) label.textContent = `${filtered.length} solicitud${filtered.length !== 1 ? 'es' : ''}`;
    renderTitleRequests(filtered);
}

function renderTitleRequests(requests) {
    const container = document.getElementById('titleRequestsList');
    if (!container) return;
    if (requests.length === 0) {
        container.innerHTML = '<p class="admin-loading">No hay solicitudes en esta categoría.</p>';
        return;
    }
    const statusLabels = { pending: '⏳ Pendiente', approved: '✅ Aprobado', rejected: '❌ Rechazado' };
    container.innerHTML = requests.map(r => `
        <div class="title-request-card" data-request-id="${r.id}">
            <div class="title-request-info">
                <span class="title-request-user">👤 ${escapeHtml(r.username)}</span>
                <span class="title-request-text">"${escapeHtml(r.title_text)}"</span>
                <span class="title-request-date">${formatDate(r.created_at)}</span>
                ${r.admin_note ? `<em style="font-size:12px;color:#888">Nota: ${escapeHtml(r.admin_note)}</em>` : ''}
            </div>
            <div class="title-request-actions">
                <span class="title-request-status title-request-status--${r.status}">${statusLabels[r.status] || r.status}</span>
                ${r.status === 'pending' ? `
                    <input type="text" class="admin-modal-input" id="note-${r.id}"
                           placeholder="Nota opcional..." maxlength="200"
                           style="width:170px;font-size:12px;padding:6px 10px">
                    <button class="admin-btn admin-btn--unban" onclick="reviewTitleRequest(${r.id}, 'approved')">✅ Aprobar</button>
                    <button class="admin-btn admin-btn--ban" onclick="reviewTitleRequest(${r.id}, 'rejected')">❌ Rechazar</button>
                ` : ''}
            </div>
        </div>`).join('');
}

async function reviewTitleRequest(id, status) {
    const noteInput = document.getElementById(`note-${id}`);
    const note = noteInput?.value?.trim() || null;
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/title-requests/${id}`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify({ status, admin_note: note })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        await loadTitleRequests();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

window.openCreateItemModal = openCreateItemModal;
window.openEditItemModal = openEditItemModal;
window.closeShopItemModal = closeShopItemModal;
window.submitShopItem = submitShopItem;
window.onItemTypeChange = onItemTypeChange;
window.toggleItemActive = toggleItemActive;
window.deleteShopItem = deleteShopItem;
window.filterTitleRequests = filterTitleRequests;
window.reviewTitleRequest = reviewTitleRequest;

// Cerrar modal de tienda al hacer clic fuera
document.addEventListener('click', function(e) {
    const shopModal = document.getElementById('shopItemModal');
    if (shopModal && e.target === shopModal) closeShopItemModal();
});

// ============================================================
// ===== APUESTAS =====
// ============================================================

let _betEvents = [];
let _betResolveEventId = null;
let _betResolveTeamA = '';
let _betResolveTeamB = '';

async function loadBetEvents() {
    const container = document.getElementById('betEventsList');
    const label     = document.getElementById('betEventsCountLabel');
    try {
        const res  = await fetch(`${ADMIN_API}/api/admin/bet-events`, { headers: getAuthHeader() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        _betEvents = data.events || [];
        if (label) label.textContent = `${_betEvents.length} eventos`;
        renderBetEvents();
    } catch (err) {
        if (container) container.innerHTML = `<p class="admin-loading">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function _betStatusBadge(status) {
    const map = {
        open:      '<span class="admin-type-badge" style="background:rgba(76,175,80,0.15);color:#66bb6a">🟢 Abierta</span>',
        closed:    '<span class="admin-type-badge" style="background:rgba(255,193,7,0.15);color:#ffc107">🔒 Cerrada</span>',
        resolved:  '<span class="admin-type-badge" style="background:rgba(66,165,245,0.15);color:#42a5f5">🏁 Resuelta</span>',
        cancelled: '<span class="admin-type-badge" style="background:rgba(244,67,54,0.15);color:#ef5350">❌ Cancelada</span>'
    };
    return map[status] || status;
}

function renderBetEvents() {
    const container = document.getElementById('betEventsList');
    if (!container) return;
    if (_betEvents.length === 0) {
        container.innerHTML = '<p class="admin-loading">No hay eventos de apuestas.</p>';
        return;
    }
    container.innerHTML = _betEvents.map(ev => `
        <div class="title-request-card">
            <div class="title-request-info">
                <span class="title-request-user">${escapeHtml(ev.title)}</span>
                <span class="title-request-text" style="font-size:13px;color:#ccc">${escapeHtml(ev.team_a)} vs ${escapeHtml(ev.team_b)}</span>
                <span class="title-request-date">
                    ${_betStatusBadge(ev.status)}
                    · 🎰 ${ev.total_bets} apuestas · 🪙 ${ev.total_pool} en juego
                    ${ev.winner ? `· Ganador: <strong>${ev.winner === 'team_a' ? ev.team_a : ev.winner === 'team_b' ? ev.team_b : 'Empate'}</strong>` : ''}
                </span>
            </div>
            <div class="title-request-actions">
                ${ev.status === 'open' ? `<button class="admin-btn admin-btn--ghost" style="font-size:12px" onclick="closeBetEvent(${ev.id})">🔒 Cerrar apuestas</button>` : ''}
                ${ev.status !== 'resolved' && ev.status !== 'cancelled' ? `<button class="admin-btn admin-btn--primary" style="font-size:12px" onclick="openBetResolveModal(${ev.id}, '${escapeHtml(ev.team_a)}', '${escapeHtml(ev.team_b)}', '${escapeHtml(ev.title)}')">🏁 Resolver</button>` : ''}
                ${ev.total_bets === 0 ? `<button class="admin-btn admin-btn--danger" style="font-size:12px" onclick="deleteBetEvent(${ev.id})">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
}

function openCreateBetEventModal() {
    ['betEventTitle','betEventDesc','betEventTeamA','betEventTeamB','betEventCloses'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('betEventModalFeedback').textContent = '';
    document.getElementById('betEventModal').style.display = 'flex';
}

function closeBetEventModal() {
    document.getElementById('betEventModal').style.display = 'none';
}

async function submitBetEvent() {
    const feedback = document.getElementById('betEventModalFeedback');
    const title   = document.getElementById('betEventTitle').value.trim();
    const desc    = document.getElementById('betEventDesc').value.trim();
    const teamA   = document.getElementById('betEventTeamA').value.trim();
    const teamB   = document.getElementById('betEventTeamB').value.trim();
    const closes  = document.getElementById('betEventCloses').value;
    if (!title || !teamA || !teamB) {
        feedback.textContent = 'Título, Equipo A y Equipo B son obligatorios.';
        return;
    }
    feedback.textContent = 'Creando...';
    try {
        const res  = await fetch(`${ADMIN_API}/api/admin/bet-events`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ title, description: desc || null, team_a: teamA, team_b: teamB, closes_at: closes || null })
        });
        const data = await res.json();
        if (!res.ok) { feedback.textContent = data.error || 'Error'; return; }
        closeBetEventModal();
        await loadBetEvents();
    } catch (err) {
        feedback.textContent = 'Error de conexión.';
    }
}

async function closeBetEvent(id) {
    if (!confirm('¿Cerrar las apuestas de este evento? Los usuarios ya no podrán apostar.')) return;
    try {
        const res = await fetch(`${ADMIN_API}/api/admin/bet-events/${id}/close`, { method: 'PATCH', headers: getAuthHeader() });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Error'); return; }
        await loadBetEvents();
    } catch (err) { alert('Error de conexión.'); }
}

function openBetResolveModal(id, teamA, teamB, title) {
    _betResolveEventId = id;
    _betResolveTeamA   = teamA;
    _betResolveTeamB   = teamB;
    document.getElementById('betResolveEventName').textContent = title;
    document.getElementById('betWinnerA').textContent = teamA;
    document.getElementById('betWinnerB').textContent = teamB;
    document.getElementById('betWinnerSelect').value = 'team_a';
    document.getElementById('betResolveModalFeedback').textContent = '';
    document.getElementById('betResolveModal').style.display = 'flex';
}

function closeBetResolveModal() {
    document.getElementById('betResolveModal').style.display = 'none';
}

async function submitBetResolve() {
    const feedback = document.getElementById('betResolveModalFeedback');
    const winner   = document.getElementById('betWinnerSelect').value;
    feedback.textContent = 'Procesando...';
    try {
        const res  = await fetch(`${ADMIN_API}/api/admin/bet-events/${_betResolveEventId}/resolve`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify({ winner })
        });
        const data = await res.json();
        if (!res.ok) { feedback.textContent = data.error || 'Error'; return; }
        closeBetResolveModal();
        await loadBetEvents();
        alert(data.message);
    } catch (err) {
        feedback.textContent = 'Error de conexión.';
    }
}

async function deleteBetEvent(id) {
    if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
    try {
        const res  = await fetch(`${ADMIN_API}/api/admin/bet-events/${id}`, { method: 'DELETE', headers: getAuthHeader() });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Error'); return; }
        await loadBetEvents();
    } catch (err) { alert('Error de conexión.'); }
}

window.openCreateBetEventModal = openCreateBetEventModal;
window.closeBetEventModal      = closeBetEventModal;
window.submitBetEvent          = submitBetEvent;
window.closeBetEvent           = closeBetEvent;
window.openBetResolveModal     = openBetResolveModal;
window.closeBetResolveModal    = closeBetResolveModal;
window.submitBetResolve        = submitBetResolve;
window.deleteBetEvent          = deleteBetEvent;

document.addEventListener('click', function(e) {
    const betModal    = document.getElementById('betEventModal');
    const resolveModal = document.getElementById('betResolveModal');
    if (betModal     && e.target === betModal)     closeBetEventModal();
    if (resolveModal && e.target === resolveModal) closeBetResolveModal();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    initAuth();
    if (!ensureAdmin()) return;
    loadAdminStats();
    loadAdminUsers();
    loadAdminReviews();
    loadShopItems();
    loadTitleRequests();
    loadBetEvents();
});
