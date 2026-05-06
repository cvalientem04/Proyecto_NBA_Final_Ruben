// ============================================================
// auth.js - Sesion y autenticacion cliente
// Protege paginas privadas y pinta datos del usuario en el header.
// ============================================================

function _getHeaderCosmetics() {
    try {
        const raw = localStorage.getItem('nba_cosmetics');
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function saveHeaderCosmetics(badge, color) {
    try {
        const current = _getHeaderCosmetics();
        if (badge !== undefined) current.badge = badge;
        if (color !== undefined) current.color = color;
        localStorage.setItem('nba_cosmetics', JSON.stringify(current));
    } catch (e) {}
}

function _authEscapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getCurrentUserFromStorage() {
    try {
        const userRaw = localStorage.getItem('nba_user');
        if (!userRaw) return null;
        return JSON.parse(userRaw);
    } catch (error) {
        console.warn('No se pudo leer nba_user del storage:', error);
        return null;
    }
}

function isAuthenticated() {
    const token = localStorage.getItem('nba_token');
    const user = getCurrentUserFromStorage();
    return Boolean(token && user);
}

function isAdmin() {
    const user = getCurrentUserFromStorage();
    return Boolean(user && user.role === 'admin');
}

function ensureAuthenticated() {
    if (isAuthenticated()) return true;

    window.location.href = 'login.html';
    return false;
}

function renderHeaderUserData() {
    const user = getCurrentUserFromStorage();
    if (!user) return;

    const nameElement = document.getElementById('userName');
    const coinsElement = document.getElementById('userCoins');

    if (nameElement) {
        const adminBadge = user.role === 'admin' ? ' 👑' : '';
        const safeName = _authEscapeHtml(user.username || 'Usuario');
        const cosmetics = _getHeaderCosmetics();
        const badgeEmoji = cosmetics.badge ? `<span style="font-size:14px">${_authEscapeHtml(cosmetics.badge)}</span>` : '';
        const prefix = badgeEmoji || _authEscapeHtml(user.avatar || '🏀');
        const colorStyle = cosmetics.color ? ` style="color:${_authEscapeHtml(cosmetics.color)}"` : '';
        nameElement.innerHTML = `<a href="profile.html" class="user-profile-link">${prefix} <span${colorStyle}>${safeName}</span>${adminBadge}</a>`;
    }

    if (coinsElement) {
        coinsElement.textContent = `🪙 ${user.coins || 0}`;
    }

    // Inyectar botón de admin en el header si es administrador
    const userArea = document.getElementById('userArea');
    if (userArea && user.role === 'admin' && !document.getElementById('adminNavBtn')) {
        const adminBtn = document.createElement('a');
        adminBtn.id = 'adminNavBtn';
        adminBtn.href = 'admin.html';
        adminBtn.className = 'admin-nav-btn';
        adminBtn.textContent = '👑 Admin';
        const logoutBtn = userArea.querySelector('.logout-btn');
        if (logoutBtn) {
            userArea.insertBefore(adminBtn, logoutBtn);
        } else {
            userArea.appendChild(adminBtn);
        }
    }

    // Mostrar/ocultar tarjeta admin en la home
    const adminCard = document.getElementById('adminHomeCard');
    if (adminCard) {
        adminCard.style.display = user.role === 'admin' ? '' : 'none';
    }
}

/**
 * Fusiona monedas locales con las del servidor al hacer login.
 * Toma el maximo entre las monedas guardadas y las que devuelve el server,
 * para que el usuario nunca pierda monedas ganadas en minijuegos.
 */
function mergeCoinsOnLogin(serverUser) {
    try {
        const previousRaw = localStorage.getItem('nba_user');
        if (!previousRaw) return serverUser;

        const previous = JSON.parse(previousRaw);
        const localCoins = Number(previous.coins || 0);
        const serverCoins = Number(serverUser.coins || 0);

        serverUser.coins = Math.max(localCoins, serverCoins);
    } catch (error) {
        console.warn('No se pudo fusionar monedas:', error);
    }
    return serverUser;
}

function logout() {
    localStorage.removeItem('nba_token');
    localStorage.removeItem('nba_user');
    window.location.href = 'login.html';
}

function initAuth() {
    const isProtectedPage = !window.location.pathname.toLowerCase().endsWith('/login.html')
        && !window.location.pathname.toLowerCase().endsWith('/signup.html');

    if (isProtectedPage && !ensureAuthenticated()) {
        return false;
    }

    renderHeaderUserData();
    return true;
}

window.getCurrentUserFromStorage = getCurrentUserFromStorage;
window.saveHeaderCosmetics = saveHeaderCosmetics;
window.isAuthenticated = isAuthenticated;
window.isAdmin = isAdmin;
window.ensureAuthenticated = ensureAuthenticated;
window.renderHeaderUserData = renderHeaderUserData;
window.logout = logout;
window.initAuth = initAuth;
