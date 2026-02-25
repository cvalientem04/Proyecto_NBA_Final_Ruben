// URL del servidor (cambia a tu dominio en producción)
const API_SERVER = 'http://localhost:3000';

// Cargar partidos de hoy
async function loadGames() {
    /* if (!API_KEY) {
        alert('Por favor configura tu API Key primero');
        return;
    }*/

    const gamesContainer = document.getElementById('games-container');
    gamesContainer.innerHTML = '<div class="loading">Cargando partidos en vivo...</div>';

    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Ahora llama a TU servidor, no directamente a la API
        const response = await fetch(`${API_SERVER}/api/games?dates=${today}`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const games = data.data;

        if (!games || games.length === 0) {
            gamesContainer.innerHTML = `
                <div class="error-message">
                    <h3>📅 No hay partidos programados para hoy</h3>
                    <p>Cargando partidos recientes...</p>
                </div>
            `;
            loadRecentGames();
            return;
        }

        renderGames(games);

    } catch (error) {
        console.error('Error:', error);
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>❌ Error al cargar los partidos</h3>
                <p>${error.message}</p>
                <p style="margin-top: 15px; color: #666;">Verifica que tu API Key sea correcta</p>
            </div>
        `;
    }
}

// Cargar partidos recientes
async function loadRecentGames() {
    const gamesContainer = document.getElementById('games-container');

    try {
        // Llama al endpoint de partidos recientes en tu servidor
        const response = await fetch(`${API_SERVER}/api/games/recent`);

        if (!response.ok) throw new Error('Error al cargar partidos recientes');

        const data = await response.json();
        renderGames(data.data);

    } catch (error) {
        console.error('Error:', error);
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>❌ No se pudieron cargar los partidos</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}
// Esto hace scroll suave hasta la sección de Scores
document.getElementById('scores').scrollIntoView({behavior: 'smooth'});

// Opcional: Ejecuta tu función de recargar partidos para asegurar datos frescos
if(typeof loadGames === 'function') { loadGames(); }

// Renderizar partidos
function renderGames(games) {
    const gamesContainer = document.getElementById('games-container');
    
    if (!games || games.length === 0) {
        gamesContainer.innerHTML = `
            <div class="error-message">
                <h3>🏀 No hay partidos disponibles</h3>
                <p>Intenta de nuevo más tarde</p>
            </div>
        `;
        return;
    }

    gamesContainer.innerHTML = games.map(game => {
        const homeTeam = game.home_team;
        const visitorTeam = game.visitor_team;
        const homeScore = game.home_team_score || 0;
        const visitorScore = game.visitor_team_score || 0;
        const status = game.status || 'Scheduled';
        
        let statusHTML = '';
        let isLive = false;
        
        if (status.includes('Final')) {
            statusHTML = '<div class="game-status">FINAL</div>';
        } else if (status.includes('Qtr') || status.includes('Half')) {
            statusHTML = `<div class="game-status"><span class="live-indicator"></span>${status}</div>`;
            isLive = true;
        } else if (status.includes(':')) {
            statusHTML = '';
        }

        const gameDate = new Date(game.date);
        const dateStr = gameDate.toLocaleDateString('es-ES', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="game-card ${isLive ? 'live' : ''}">
                ${statusHTML}
                <div class="team">
                    <div class="team-logo">${visitorTeam.abbreviation}</div>
                    <div class="team-info">
                        <span class="team-name">${visitorTeam.full_name}</span>
                        <span class="team-record">${visitorTeam.conference}</span>
                    </div>
                </div>
                <span class="score">${visitorScore}</span>
                <span class="vs">vs</span>
                <span class="score">${homeScore}</span>
                <div class="team">
                    <div class="team-info" style="text-align: right;">
                        <span class="team-name">${homeTeam.full_name}</span>
                        <span class="team-record">${homeTeam.conference}</span>
                    </div>
                    <div class="team-logo">${homeTeam.abbreviation}</div>
                </div>
                ${!isLive && status === 'Scheduled' ? `<div class="game-time">${dateStr}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Auto-actualizar cada 30 segundos si hay API Key
/*setInterval(() => {
    // if (API_KEY) {
        loadGames();
    //}
}, 300000);*/
setInterval(() => {
    loadGames();
}, 15000); // 15 segundos (Total: 4 peticiones por minuto)
loadGames();

// ============ NOTICIAS ESPN ============

// Cargar noticias de ESPN (API gratuita sin key)
async function loadNews() {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '<div class="loading">Cargando noticias de ESPN...</div>';

    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news');
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const articles = data.articles;

        if (!articles || articles.length === 0) {
            newsContainer.innerHTML = `
                <div class="error-message">
                    <h3>📰 No hay noticias disponibles</h3>
                    <p>Intenta de nuevo más tarde</p>
                </div>
            `;
            return;
        }

        renderNews(articles);

    } catch (error) {
        console.error('Error cargando noticias:', error);
        newsContainer.innerHTML = `
            <div class="error-message">
                <h3>❌ Error al cargar las noticias</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Renderizar noticias
function renderNews(articles) {
    const newsContainer = document.getElementById('news-container');
    
    // Mostrar máximo 6 noticias
    const newsToShow = articles.slice(0, 6);
    
    newsContainer.innerHTML = newsToShow.map(article => {
        // Obtener imagen (si existe)
        const imageUrl = article.images && article.images.length > 0 
            ? article.images[0].url 
            : 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop';
        
        // Obtener categoría
        const category = article.categories && article.categories.length > 0 
            ? article.categories[0].description || 'NBA'
            : 'NBA';
        
        // Obtener descripción
        const description = article.description || '';
        
        // URL del artículo
        const articleUrl = article.links?.web?.href || '#';

        return `
            <article class="news-card" onclick="window.open('${articleUrl}', '_blank')">
                <img src="${imageUrl}" alt="${article.headline}" class="news-image" onerror="this.src='https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop'">
                <div class="news-content">
                    <div class="news-category">${category}</div>
                    <h3 class="news-title">${article.headline}</h3>
                    <p class="news-excerpt">${description}</p>
                </div>
            </article>
        `;
    }).join('');
}

// Cargar noticias al iniciar
loadNews();

// ============ SCROLL SUAVE A SCORES DEL CHATBOT ============

// Función para ir a la sección de Scores con scroll suave
function scrollToScores() {
    document.getElementById('scores').scrollIntoView({behavior: 'smooth'});
    
    // Ejecuta la función de recargar partidos para asegurar datos frescos
    if(typeof loadGames === 'function') { loadGames(); }
}