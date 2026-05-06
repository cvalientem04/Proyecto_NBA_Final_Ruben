// ============================================================
// shop.js - Tienda Virtual NBA LIVE
// ============================================================

const SHOP_API = 'http://localhost:3000';

let allItems = [];
let userInventory = [];
let userCosmetics = null;
let userCoins = 0;
let currentTab = 'badges';

function getAuthHeader() {
    const token = localStorage.getItem('nba_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateCoinsDisplay(coins) {
    userCoins = Number(coins) || 0;
    const shopEl = document.getElementById('shopCoins');
    if (shopEl) shopEl.textContent = userCoins.toLocaleString();
    const headerEl = document.getElementById('userCoins');
    if (headerEl) headerEl.textContent = `🪙 ${userCoins.toLocaleString()}`;
    const user = window.getCurrentUserFromStorage?.();
    if (user) {
        user.coins = userCoins;
        localStorage.setItem('nba_user', JSON.stringify(user));
    }
}

async function loadShopItems() {
    const res = await fetch(`${SHOP_API}/api/shop/items`);
    if (!res.ok) throw new Error('Error cargando tienda');
    const data = await res.json();
    allItems = data.items || [];
}

async function loadInventory() {
    const res = await fetch(`${SHOP_API}/api/shop/inventory`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Error cargando inventario');
    const data = await res.json();
    userInventory = data.inventory || [];
    userCosmetics = data.cosmetics || null;
    syncCosmeticsToHeader();
}

function syncCosmeticsToHeader() {
    if (!window.saveHeaderCosmetics) return;
    const badge = userInventory.find(i => i.id === userCosmetics?.equipped_badge_id);
    const color = userInventory.find(i => i.id === userCosmetics?.equipped_color_id);
    window.saveHeaderCosmetics(badge?.icon_emoji || null, color?.color_hex || null);
    if (window.renderHeaderUserData) window.renderHeaderUserData();
}

function isOwned(itemId) {
    return userInventory.some(i => i.id === itemId);
}

function getEquippedIdByType(type) {
    if (!userCosmetics) return null;
    const map = {
        badge: userCosmetics.equipped_badge_id,
        color: userCosmetics.equipped_color_id,
        frame: userCosmetics.equipped_frame_id
    };
    return map[type] ?? null;
}

function isEquipped(itemId, type) {
    return getEquippedIdByType(type) === itemId;
}

function renderItemCard(item) {
    const owned = isOwned(item.id);
    const equipped = isEquipped(item.id, item.type);
    const canAfford = userCoins >= item.price;

    let visualEl;
    if (item.type === 'color' && item.color_hex) {
        visualEl = `<div class="shop-color-preview" style="background:${escHtml(item.color_hex)}"></div>`;
    } else {
        visualEl = `<div class="shop-item-icon">${escHtml(item.icon_emoji || '❓')}</div>`;
    }

    let actionBtn;
    if (item.type === 'title') {
        if (owned) {
            actionBtn = `<button class="shop-btn shop-btn--equip" onclick="switchShopTab('title')">✏️ Gestionar</button>`;
        } else {
            actionBtn = `<button class="shop-btn shop-btn--buy${!canAfford ? ' shop-btn--disabled' : ''}"
                         onclick="${canAfford ? `buyItem(${item.id})` : 'void(0)'}"
                         title="${!canAfford ? 'No tienes suficientes monedas' : ''}">
                         🪙 ${item.price.toLocaleString()}</button>`;
        }
    } else if (equipped) {
        actionBtn = `<button class="shop-btn shop-btn--equipped" onclick="unequipItem('${item.type}')">✓ Equipado — Quitar</button>`;
    } else if (owned) {
        actionBtn = `<button class="shop-btn shop-btn--equip" onclick="equipItem(${item.id})">Equipar</button>`;
    } else {
        actionBtn = `<button class="shop-btn shop-btn--buy${!canAfford ? ' shop-btn--disabled' : ''}"
                     onclick="${canAfford ? `buyItem(${item.id})` : 'void(0)'}"
                     title="${!canAfford ? 'No tienes suficientes monedas' : ''}">
                     🪙 ${item.price.toLocaleString()}</button>`;
    }

    return `<div class="shop-item-card${owned ? ' shop-item-card--owned' : ''}${equipped ? ' shop-item-card--equipped' : ''}">
        ${owned ? '<div class="shop-item-owned-badge">✓ Tuyo</div>' : ''}
        ${visualEl}
        <div class="shop-item-name">${escHtml(item.name)}</div>
        <div class="shop-item-desc">${escHtml(item.description || '')}</div>
        ${actionBtn}
    </div>`;
}

function renderGrid(gridId, type) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const items = allItems.filter(i => i.type === type);
    if (items.length === 0) {
        grid.innerHTML = '<p class="shop-empty">No hay items disponibles.</p>';
        return;
    }
    grid.innerHTML = items.map(renderItemCard).join('');
}

function renderTitleTab() {
    const container = document.getElementById('title-slot-content');
    if (!container) return;

    const titleItem = allItems.find(i => i.type === 'title');
    if (!titleItem) {
        container.innerHTML = '<p class="shop-empty">No hay slot de título disponible.</p>';
        return;
    }

    const owned = isOwned(titleItem.id);
    const activeTitle = userCosmetics?.active_title || '';
    const canAfford = userCoins >= titleItem.price;

    let html = `<div class="title-slot-box">
        <div class="title-slot-header">
            <span class="title-slot-icon">✏️</span>
            <h3>Título Personalizado</h3>
        </div>
        <p class="title-slot-desc">Crea un título único que aparecerá bajo tu nombre en las reseñas. El administrador lo revisará antes de publicarlo. Puedes solicitar cambiarlo cuando quieras.</p>`;

    if (activeTitle) {
        html += `<div class="title-slot-current">
            <span class="title-slot-label">Tu título activo:</span>
            <span class="title-slot-value">"${escHtml(activeTitle)}"</span>
        </div>`;
    }

    if (!owned) {
        html += `<div class="title-slot-buy">
            <p>Para obtener un título personalizado, compra el slot por <strong>🪙 ${titleItem.price.toLocaleString()}</strong>.</p>
            <button class="shop-btn shop-btn--buy${!canAfford ? ' shop-btn--disabled' : ''}"
                    onclick="${canAfford ? `buyItem(${titleItem.id})` : 'void(0)'}">
                🪙 ${titleItem.price.toLocaleString()} — Comprar Slot
            </button>
            ${!canAfford ? `<p class="title-slot-lack">Necesitas ${(titleItem.price - userCoins).toLocaleString()} monedas más. ¡Gana monedas jugando los minijuegos!</p>` : ''}
        </div>`;
    } else {
        html += `<div class="title-slot-form">
            <div id="title-request-status"></div>
            <div class="community-field">
                <label for="titleInput">Tu título personalizado</label>
                <input id="titleInput" type="text" maxlength="50"
                       placeholder="Ej: El mayor hater de LeBron"
                       class="admin-modal-input"
                       value="${escHtml(activeTitle)}">
                <span class="title-slot-counter" id="titleCounter">${activeTitle.length}/50</span>
            </div>
            <button class="shop-btn shop-btn--primary" onclick="submitTitleRequest()">
                Enviar para revisión del admin
            </button>
            <p id="titleFeedback" class="community-feedback"></p>
        </div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    const titleInput = document.getElementById('titleInput');
    const counter = document.getElementById('titleCounter');
    if (titleInput && counter) {
        titleInput.addEventListener('input', () => { counter.textContent = `${titleInput.value.length}/50`; });
    }

    if (owned) loadTitleRequestStatus();
}

async function loadTitleRequestStatus() {
    const el = document.getElementById('title-request-status');
    if (!el) return;
    try {
        const res = await fetch(`${SHOP_API}/api/title-request/status`, { headers: getAuthHeader() });
        const data = await res.json();
        if (!data.request) return;
        const r = data.request;
        const labels = {
            pending: '⏳ Pendiente de revisión por el admin',
            approved: '✅ Aprobado y visible en tus reseñas',
            rejected: '❌ Rechazado por el admin'
        };
        el.innerHTML = `<div class="title-status-card title-status--${r.status}">
            <strong>${labels[r.status] || r.status}</strong>
            <span>"${escHtml(r.title_text)}"</span>
            ${r.admin_note ? `<em>Nota del admin: ${escHtml(r.admin_note)}</em>` : ''}
        </div>`;
    } catch (err) {
        console.error('Error estado título:', err);
    }
}

function renderInventory() {
    const container = document.getElementById('inventory-content');
    if (!container) return;

    if (userInventory.length === 0) {
        container.innerHTML = `<div class="shop-empty">
            <p style="font-size:32px;margin-bottom:8px">🎒</p>
            <p>No tienes ningún item todavía.</p>
            <p style="margin-top:8px;font-size:13px;color:#666">Ve a las otras pestañas para comprar insignias, colores y más con tus monedas.</p>
        </div>`;
        return;
    }

    const equippedBadge = userInventory.find(i => i.id === userCosmetics?.equipped_badge_id);
    const equippedColor = userInventory.find(i => i.id === userCosmetics?.equipped_color_id);
    const equippedFrame = userInventory.find(i => i.id === userCosmetics?.equipped_frame_id);
    const activeTitle = userCosmetics?.active_title;
    const titleItem = allItems.find(i => i.type === 'title');
    const ownsTitleSlot = titleItem ? isOwned(titleItem.id) : false;

    let html = `<div class="inventory-equipped-section">
        <h3 class="inventory-section-title">⚡ Actualmente equipado</h3>
        <div class="inventory-equipped-grid">
            <div class="inventory-equipped-slot">
                <span class="inventory-slot-label">🎖️ Insignia</span>
                <span class="inventory-slot-value">${equippedBadge ? escHtml(equippedBadge.icon_emoji + ' ' + equippedBadge.name) : '🏀 Por defecto'}</span>
                ${equippedBadge ? `<button class="shop-btn shop-btn--sm shop-btn--ghost" onclick="unequipItem('badge')" style="margin-top:8px">Quitar</button>` : ''}
            </div>
            <div class="inventory-equipped-slot">
                <span class="inventory-slot-label">🎨 Color de nombre</span>
                <span class="inventory-slot-value"${equippedColor?.color_hex ? ` style="color:${escHtml(equippedColor.color_hex)}"` : ''}>
                    ${equippedColor ? escHtml(equippedColor.name) : '—'}
                </span>
                ${equippedColor ? `<button class="shop-btn shop-btn--sm shop-btn--ghost" onclick="unequipItem('color')" style="margin-top:8px">Quitar</button>` : ''}
            </div>
            <div class="inventory-equipped-slot">
                <span class="inventory-slot-label">🖼️ Marco de avatar</span>
                <span class="inventory-slot-value">${equippedFrame ? escHtml(equippedFrame.icon_emoji + ' ' + equippedFrame.name) : '—'}</span>
                ${equippedFrame ? `<button class="shop-btn shop-btn--sm shop-btn--ghost" onclick="unequipItem('frame')" style="margin-top:8px">Quitar</button>` : ''}
            </div>
            <div class="inventory-equipped-slot">
                <span class="inventory-slot-label">✏️ Título personalizado</span>
                <span class="inventory-slot-value">${activeTitle ? `"${escHtml(activeTitle)}"` : '—'}</span>
                ${ownsTitleSlot ? `<button class="shop-btn shop-btn--sm shop-btn--ghost" onclick="switchShopTab('title')" style="margin-top:8px">Gestionar</button>` : ''}
            </div>
        </div>
    </div>
    <h3 class="inventory-section-title" style="margin-bottom:16px">🎒 Todos mis items (${userInventory.length})</h3>
    <div class="shop-items-grid">${userInventory.map(renderItemCard).join('')}</div>`;

    container.innerHTML = html;
}

async function buyItem(itemId) {
    try {
        const res = await fetch(`${SHOP_API}/api/shop/buy`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ item_id: itemId })
        });
        const data = await res.json();
        if (!res.ok) { showNotification(data.error || 'Error al comprar.', 'error'); return; }
        updateCoinsDisplay(data.coins);
        await loadInventory();
        refreshCurrentTab();
        showNotification(`✅ ¡Compraste "${data.item.name}"!`);
        if (data.item.type === 'title') switchShopTab('title');
    } catch (err) {
        showNotification('Error de conexión. Inténtalo de nuevo.', 'error');
    }
}

async function equipItem(itemId) {
    try {
        const res = await fetch(`${SHOP_API}/api/shop/equip`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ item_id: itemId })
        });
        const data = await res.json();
        if (!res.ok) { showNotification(data.error || 'Error al equipar.', 'error'); return; }
        await loadInventory();
        refreshCurrentTab();
        showNotification('✅ Item equipado correctamente.');
    } catch (err) {
        showNotification('Error de conexión.', 'error');
    }
}

async function unequipItem(type) {
    try {
        const res = await fetch(`${SHOP_API}/api/shop/unequip`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (!res.ok) { showNotification(data.error || 'Error.', 'error'); return; }
        await loadInventory();
        refreshCurrentTab();
        showNotification('Item quitado.', 'info');
    } catch (err) {
        showNotification('Error de conexión.', 'error');
    }
}

async function submitTitleRequest() {
    const input = document.getElementById('titleInput');
    const feedback = document.getElementById('titleFeedback');
    if (!input) return;
    const text = input.value.trim();
    if (text.length < 3) {
        if (feedback) { feedback.textContent = 'El título debe tener al menos 3 caracteres.'; feedback.className = 'community-feedback error'; }
        return;
    }
    try {
        const res = await fetch(`${SHOP_API}/api/title-request`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ title_text: text })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        if (feedback) { feedback.textContent = '✅ ' + data.message; feedback.className = 'community-feedback success'; }
        loadTitleRequestStatus();
    } catch (err) {
        if (feedback) { feedback.textContent = `Error: ${err.message}`; feedback.className = 'community-feedback error'; }
    }
}

function switchShopTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.shop-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.shop-tab').forEach(btn => btn.classList.remove('active'));
    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.style.display = '';
    const btn = document.querySelector(`.shop-tab[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    if (tabName === 'title') renderTitleTab();
    else if (tabName === 'inventory') renderInventory();
}

function refreshCurrentTab() {
    const map = {
        badges: () => renderGrid('badges-grid', 'badge'),
        colors: () => renderGrid('colors-grid', 'color'),
        frames: () => renderGrid('frames-grid', 'frame'),
        title: () => renderTitleTab(),
        inventory: () => renderInventory()
    };
    if (map[currentTab]) map[currentTab]();
}

function showNotification(msg, type = 'success') {
    const notif = document.getElementById('shop-notification');
    if (!notif) return;
    notif.textContent = msg;
    notif.className = `shop-notification shop-notification--${type}`;
    notif.style.opacity = '1';
    clearTimeout(notif._timer);
    notif._timer = setTimeout(() => { notif.style.opacity = '0'; }, 3000);
}

window.switchShopTab = switchShopTab;
window.buyItem = buyItem;
window.equipItem = equipItem;
window.unequipItem = unequipItem;
window.submitTitleRequest = submitTitleRequest;

document.addEventListener('DOMContentLoaded', async function () {
    initAuth();
    const user = window.getCurrentUserFromStorage?.();
    if (user) updateCoinsDisplay(user.coins || 0);

    try {
        await Promise.all([loadShopItems(), loadInventory()]);
        renderGrid('badges-grid', 'badge');
        renderGrid('colors-grid', 'color');
        renderGrid('frames-grid', 'frame');
    } catch (err) {
        console.error('Error inicializando tienda:', err);
        ['badges-grid', 'colors-grid', 'frames-grid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="shop-empty" style="color:#e03a3e">Error al cargar. Recarga la página.</p>';
        });
    }
});
