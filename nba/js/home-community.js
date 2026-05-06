// ============================================================
// home-community.js - Reseñas conectadas a Supabase
// Las reseñas se guardan en la nube y son visibles para todos.
// ============================================================

const API_BASE = (typeof API_SERVER === 'string' && API_SERVER.trim()) ? API_SERVER : 'http://localhost:3000';

function compactText(value, maxLength) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setFormFeedback(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const className = type ? `community-feedback ${type}` : 'community-feedback';
    element.className = className;
    element.textContent = message;
}

function formatReviewDate(value) {
    if (!value) return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStarMarkup(rating) {
    const amount = Number(rating);
    if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
        return '<span class="review-stars">☆☆☆☆☆</span>';
    }

    const stars = '★★★★★'.slice(0, amount) + '☆☆☆☆☆'.slice(0, 5 - amount);
    return `<span class="review-stars">${stars}</span>`;
}

function updateReviewSummary(reviews) {
    const countElement = document.getElementById('reviews-count');
    const averageElement = document.getElementById('reviews-average');

    if (!countElement || !averageElement) return;

    const total = reviews.length;
    const sum = reviews.reduce((acc, review) => acc + Number(review.rating || 0), 0);
    const average = total > 0 ? (sum / total).toFixed(1) : '0.0';

    averageElement.textContent = average;
    countElement.textContent = `${total} reseña${total === 1 ? '' : 's'}`;

    // Actualizar estrellas del header si existe
    const starsDisplay = document.getElementById('reviews-stars-display');
    if (starsDisplay) {
        const full = Math.round(sum / total) || 0;
        starsDisplay.textContent = '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
    }
}

function renderReviewsList(reviews) {
    const listElement = document.getElementById('reviews-list');
    if (!listElement) return;

    updateReviewSummary(reviews);

    if (reviews.length === 0) {
        listElement.innerHTML = '<p class="reviews-empty">Aún no hay reseñas. ¡Sé la primera persona en opinar!</p>';
        return;
    }

    const adminUser = typeof window.isAdmin === 'function' && window.isAdmin();

    listElement.innerHTML = reviews.map(review => {
        const badge = review.badge_emoji ? `<span class="review-badge" title="Insignia">${escapeHtml(review.badge_emoji)}</span>` : '';
        const nameStyle = review.username_color ? ` style="color:${escapeHtml(review.username_color)}"` : '';
        const customTitle = review.active_title ? `<span class="review-custom-title">"${escapeHtml(review.active_title)}"</span>` : '';

        return `<article class="review-item" data-review-id="${review.id}">
            <div class="review-item-top">
                <div class="review-author">
                    <div class="review-author-line">
                        ${badge}
                        <strong${nameStyle}>${escapeHtml(review.name)}</strong>
                    </div>
                    ${customTitle}
                </div>
                ${getStarMarkup(review.rating)}
                ${adminUser ? `<button class="review-delete-btn" onclick="deleteReview(${review.id})" title="Eliminar reseña">🗑️ Eliminar</button>` : ''}
            </div>
            <p class="review-comment">${escapeHtml(review.comment)}</p>
            <p class="review-date">${escapeHtml(formatReviewDate(review.created_at))}</p>
        </article>`;
    }).join('');
}

async function deleteReview(id) {
    if (!confirm('¿Seguro que quieres eliminar esta reseña?')) return;
    try {
        const token = localStorage.getItem('nba_token');
        const response = await fetch(`${API_BASE}/api/reviews/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al eliminar');
        const article = document.querySelector(`.review-item[data-review-id="${id}"]`);
        if (article) article.remove();
        // Actualizar el contador de reseñas
        await loadReviews();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}
window.deleteReview = deleteReview;

// Cargar reseñas desde el servidor (Supabase)
async function loadReviews() {
    const listElement = document.getElementById('reviews-list');
    if (!listElement) return;

    try {
        const response = await fetch(`${API_BASE}/api/reviews`);
        if (!response.ok) throw new Error('Error al cargar reseñas');

        const data = await response.json();
        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        renderReviewsList(reviews);
    } catch (error) {
        console.error('Error cargando reseñas:', error);
        listElement.innerHTML = '<p class="reviews-empty">Error al cargar reseñas. Inténtalo más tarde.</p>';
    }
}

// Actualizar banner de reseñas en la home (nba.html)
async function updateHomeBanner() {
    const bannerAvg = document.querySelector('.reviews-banner-score');
    const bannerCount = document.querySelector('.reviews-banner-count');
    if (!bannerAvg && !bannerCount) return;

    try {
        const response = await fetch(`${API_BASE}/api/reviews`);
        if (!response.ok) return;

        const data = await response.json();
        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        const total = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        const avg = total > 0 ? (sum / total).toFixed(1) : '0.0';

        if (bannerAvg) bannerAvg.textContent = avg;
        if (bannerCount) bannerCount.textContent = `${total} reseña${total === 1 ? '' : 's'}`;
    } catch (error) {
        console.error('Error actualizando banner de reseñas:', error);
    }
}

function getAutofillName() {
    if (typeof window.getCurrentUserFromStorage === 'function') {
        const user = window.getCurrentUserFromStorage();
        if (user && user.username) {
            return String(user.username).trim();
        }
    }

    return '';
}

function prefillNames() {
    const autoName = getAutofillName();
    if (!autoName) return;

    const reviewNameInput = document.getElementById('reviewName');
    if (reviewNameInput && !reviewNameInput.value.trim()) {
        reviewNameInput.value = autoName;
    }
}

async function handleReviewSubmit(event) {
    event.preventDefault();

    const reviewNameInput = document.getElementById('reviewName');
    const reviewRatingInput = document.getElementById('reviewRating');
    const reviewCommentInput = document.getElementById('reviewComment');

    if (!reviewNameInput || !reviewRatingInput || !reviewCommentInput) return;

    const name = compactText(reviewNameInput.value, 30);
    const rating = Number(reviewRatingInput.value);
    const comment = compactText(reviewCommentInput.value, 280);

    if (name.length < 2) {
        setFormFeedback('reviewFormFeedback', 'Pon un nombre de al menos 2 caracteres.', 'error');
        return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        setFormFeedback('reviewFormFeedback', 'Selecciona una valoración de 1 a 5.', 'error');
        return;
    }

    if (comment.length < 10) {
        setFormFeedback('reviewFormFeedback', 'La reseña debe tener al menos 10 caracteres.', 'error');
        return;
    }

    try {
        // Obtener token JWT si existe
        const token = localStorage.getItem('nba_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/api/reviews`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name, rating, comment })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al publicar la reseña');
        }

        reviewCommentInput.value = '';
        reviewRatingInput.value = '';
        setFormFeedback('reviewFormFeedback', '¡Reseña publicada! Gracias por tu feedback. ⭐', 'success');

        // Recargar las reseñas para que aparezca la nueva
        await loadReviews();
    } catch (error) {
        setFormFeedback('reviewFormFeedback', `Error: ${error.message}`, 'error');
    }
}

function initHomeCommunity() {
    const reviewForm = document.getElementById('reviewForm');

    if (!reviewForm && !document.getElementById('reviews-list')) {
        // Estamos en la home, solo actualizar banner
        updateHomeBanner();
        return;
    }

    if (reviewForm && !reviewForm.dataset.bound) {
        reviewForm.addEventListener('submit', handleReviewSubmit);
        reviewForm.dataset.bound = 'true';
    }

    prefillNames();
    loadReviews();
    updateHomeBanner();
}

window.initHomeCommunity = initHomeCommunity;
