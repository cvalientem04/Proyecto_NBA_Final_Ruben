// ============================================================
// noticias.js - Carga de noticias de ESPN + modal local
// Abre cada noticia en una capa encima (sin salir de la web).
// ============================================================

let newsArticlesCache = [];
let newsModalEventsBound = false;
let activeNewsRequestId = 0;

const NEWS_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=900&h=560&fit=crop';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatNewsDate(value) {
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

function sanitizeEspnText(value) {
    const rawText = String(value || '');
    if (!rawText) return '';

    const withoutTags = rawText.replace(/<[^>]*>/g, ' ');
    const parser = document.createElement('textarea');
    parser.innerHTML = withoutTags;

    return parser.value.replace(/\s+/g, ' ').trim();
}

function getNewsArticleId(article, index) {
    return String(article?.id || article?.nowId || article?.guid || `news-${index}`);
}

function getNewsCategory(article, detail) {
    if (detail?.section) return String(detail.section);

    if (Array.isArray(article?.categories) && article.categories.length > 0) {
        return article.categories[0]?.description || 'NBA';
    }

    return 'NBA';
}

function getNewsImage(article, detail) {
    const detailImage = Array.isArray(detail?.images) && detail.images.length > 0
        ? detail.images[0]?.url
        : '';

    const baseImage = Array.isArray(article?.images) && article.images.length > 0
        ? article.images[0]?.url
        : '';

    return detailImage || baseImage || NEWS_FALLBACK_IMAGE;
}

function getNewsLink(article, detail) {
    return detail?.links?.web?.href
        || article?.links?.web?.href
        || article?.links?.mobile?.href
        || '#';
}

function buildModalArticleView(article, detail, isLoadingDetail) {
    const headline = detail?.headline || article?.headline || 'Noticia NBA';
    const description = sanitizeEspnText(detail?.description || article?.description || 'No hay descripcion disponible para esta noticia.');
    const extendedText = sanitizeEspnText(detail?.story || detail?.summary || '');
    const source = detail?.source || article?.source || 'ESPN';
    const published = detail?.published || article?.published || article?.lastModified;
    const category = getNewsCategory(article, detail);
    const imageUrl = getNewsImage(article, detail);
    const articleLink = getNewsLink(article, detail);

    return `
        <div class="news-modal-fixed-top">
            <header class="news-modal-header">
                <p class="news-modal-kicker">${escapeHtml(category)}</p>
                <h3>${escapeHtml(headline)}</h3>
                <p class="news-modal-meta">${escapeHtml(source)} · ${escapeHtml(formatNewsDate(published))}</p>
            </header>
        </div>
        <div class="news-modal-scroll-body">
            <div class="news-modal-body">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(headline)}" class="news-modal-image" onerror="this.src='${NEWS_FALLBACK_IMAGE}'">
                <div class="news-modal-text">
                    <p>${escapeHtml(description)}</p>
                    ${extendedText ? `<p>${escapeHtml(extendedText)}</p>` : '<p class="news-modal-note">ESPN no envio texto largo para esta noticia, pero aqui tienes el resumen oficial.</p>'}
                    ${articleLink && articleLink !== '#' ? `<p class="news-modal-note"><a href="${escapeHtml(articleLink)}" target="_blank" rel="noopener noreferrer">Abrir noticia original</a></p>` : ''}
                    ${isLoadingDetail ? '<p class="news-modal-loading">Cargando mas detalle de ESPN...</p>' : ''}
                </div>
            </div>
        </div>
    `;
}

function getArticleFromCacheById(articleId) {
    return newsArticlesCache.find(article => String(article.__modalId) === String(articleId)) || null;
}

function openNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeNewsRequestId += 1;
}

function bindNewsModalEvents() {
    if (newsModalEventsBound) return;

    const modal = document.getElementById('news-modal');
    const closeButton = document.getElementById('news-modal-close');
    const container = document.getElementById('news-container');
    if (!modal || !closeButton || !container) return;

    closeButton.addEventListener('click', closeNewsModal);

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closeNewsModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeNewsModal();
        }
    });

    container.addEventListener('click', event => {
        const card = event.target.closest('[data-action="open-news-modal"]');
        if (!card) return;

        openNewsModalById(card.dataset.articleId);
    });

    container.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        const card = event.target.closest('[data-action="open-news-modal"]');
        if (!card) return;

        event.preventDefault();
        openNewsModalById(card.dataset.articleId);
    });

    newsModalEventsBound = true;
}

function extractHeadlineDetail(payload) {
    if (!payload || typeof payload !== 'object') return null;

    if (Array.isArray(payload.headlines) && payload.headlines.length > 0) {
        return payload.headlines[0] || null;
    }

    return payload;
}

async function fetchArticleDetail(article) {
    const detailUrl = article?.links?.api?.self?.href;
    if (!detailUrl) return null;

    try {
        const response = await fetch(detailUrl);
        if (!response.ok) return null;

        const payload = await response.json();
        return extractHeadlineDetail(payload);
    } catch (error) {
        console.warn('No se pudo cargar detalle extendido de ESPN:', error);
        return null;
    }
}

function renderNewsCards(articles) {
    const newsContainer = document.getElementById('news-container');
    if (!newsContainer) return;

    const newsToShow = articles.slice(0, 6).map((article, index) => ({
        ...article,
        __modalId: getNewsArticleId(article, index)
    }));

    newsArticlesCache = newsToShow;

    if (newsToShow.length === 0) {
        newsContainer.innerHTML = `
            <div class="error-message">
                <h3>No hay noticias disponibles</h3>
                <p>Intenta de nuevo más tarde</p>
            </div>
        `;
        return;
    }

    newsContainer.innerHTML = newsToShow.map(article => {
        const imageUrl = getNewsImage(article, null);
        const category = getNewsCategory(article, null);
        const description = sanitizeEspnText(article.description || '');
        const articleLink = getNewsLink(article, null);

        return `
            <article class="news-card" data-action="open-news-modal" data-article-id="${escapeHtml(article.__modalId)}" role="button" tabindex="0" aria-label="Abrir noticia ${escapeHtml(article.headline || 'NBA')}">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(article.headline || 'Noticia NBA')}" class="news-image" onerror="this.src='${NEWS_FALLBACK_IMAGE}'">
                <div class="news-content">
                    <div class="news-category">${escapeHtml(category)}</div>
                    <h3 class="news-title">${escapeHtml(article.headline || 'Noticia NBA')}</h3>
                    <p class="news-excerpt">${escapeHtml(description || 'Haz click para ver el resumen completo en el modal.')}</p>
                    ${articleLink && articleLink !== '#' ? '<p class="news-link-hint">Ver detalle dentro de la web</p>' : ''}
                </div>
            </article>
        `;
    }).join('');
}

async function openNewsModalById(articleId) {
    const article = getArticleFromCacheById(articleId);
    const modalContent = document.getElementById('news-modal-content');
    if (!article || !modalContent) return;

    const requestId = activeNewsRequestId + 1;
    activeNewsRequestId = requestId;

    modalContent.innerHTML = buildModalArticleView(article, null, true);
    openNewsModal();

    const detail = await fetchArticleDetail(article);
    if (requestId !== activeNewsRequestId) return;

    modalContent.innerHTML = buildModalArticleView(article, detail, false);
}

async function loadNews() {
    const newsContainer = document.getElementById('news-container');
    if (!newsContainer) return;

    newsContainer.innerHTML = '<div class="loading">Cargando noticias de ESPN...</div>';
    bindNewsModalEvents();

    try {
        const apiBase = (typeof API_SERVER === 'string' && API_SERVER.trim()) ? API_SERVER : 'http://localhost:3000';
        const response = await fetch(`${apiBase}/api/news`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const articles = Array.isArray(data?.articles) ? data.articles : [];

        renderNewsCards(articles);
    } catch (error) {
        console.error('Error cargando noticias:', error);
        newsContainer.innerHTML = `
            <div class="error-message">
                <h3>Error al cargar las noticias</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}
            