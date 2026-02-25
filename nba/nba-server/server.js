const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Tu API key está segura aquí en el servidor
const API_KEY = process.env.NBA_API_KEY;

// ============ CACHÉ EN MEMORIA ============
// Guarda las respuestas para no llamar a la API cada vez
const cache = {
    games: null,
    recentGames: null,
    gamesTimestamp: 0,
    recentTimestamp: 0,
    espnScoreboard: null,
    espnTimestamp: 0,
    nbaScoreboard: null,
    nbaScoreboardTimestamp: 0,
    standings: null,
    standingsTimestamp: 0
};
const CACHE_DURATION = 30000; // 30 segundos - la caché dura más que tus 15s de refresh

// ============ RATE LIMITING ============
// Limita peticiones por IP para evitar abusos
const limiter = rateLimit({
    windowMs: 60 * 1000,  // Ventana de 1 minuto
    max: 20,              // Máximo 20 peticiones por minuto por IP (tus 15s = 4/min, sobra margen)
    message: { error: 'Demasiadas peticiones. Espera un momento.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Permitir que tu página web acceda al servidor
app.use(cors());
app.use(limiter);

// Endpoint para obtener partidos de hoy
app.get('/api/games', async (req, res) => {
    try {
        const now = Date.now();
        
        // Si tenemos caché válida, la devolvemos sin llamar a la API
        if (cache.games && (now - cache.gamesTimestamp) < CACHE_DURATION) {
            console.log('📦 Devolviendo partidos desde caché');
            return res.json(cache.games);
        }

        console.log('🌐 Llamando a la API de NBA...');
        const dates = req.query.dates || new Date().toISOString().split('T')[0];
        
        const response = await fetch(`https://api.balldontlie.io/v1/games?dates[]=${dates}`, {
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Guardamos en caché
        cache.games = data;
        cache.gamesTimestamp = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Error al obtener partidos' });
    }
});

// Endpoint para obtener partidos recientes
app.get('/api/games/recent', async (req, res) => {
    try {
        const now = Date.now();
        
        // Si tenemos caché válida, la devolvemos
        if (cache.recentGames && (now - cache.recentTimestamp) < CACHE_DURATION) {
            console.log('📦 Devolviendo partidos recientes desde caché');
            return res.json(cache.recentGames);
        }

        console.log('🌐 Llamando a la API para partidos recientes...');
        const dates = [];
        for (let i = 1; i <= 5; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }

        const response = await fetch(`https://api.balldontlie.io/v1/games?dates[]=${dates.join('&dates[]=')}&per_page=10`, {
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Guardamos en caché
        cache.recentGames = data;
        cache.recentTimestamp = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Error al obtener partidos recientes' });
    }
});

// ============ ESPN SCOREBOARD (MARCADORES EN VIVO) ============
app.get('/api/espn/scoreboard', async (req, res) => {
    try {
        const now = Date.now();
        
        // Caché de 10 segundos para ESPN (más frecuente porque es en vivo)
        if (cache.espnScoreboard && (now - cache.espnTimestamp) < 10000) {
            console.log('📦 Devolviendo scoreboard ESPN desde caché');
            return res.json(cache.espnScoreboard);
        }

        console.log('🌐 Llamando a ESPN API...');
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Guardamos en caché
        cache.espnScoreboard = data;
        cache.espnTimestamp = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error ESPN:', error.message);
        res.status(500).json({ error: 'Error al obtener scoreboard de ESPN' });
    }
});

// ============ BALLDONTLIE STATS DE JUGADORES ============
app.get('/api/stats/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const cacheKey = `stats_${gameId}`;
        const now = Date.now();
        
        // Caché de 60 segundos para stats
        if (cache[cacheKey] && (now - cache[`${cacheKey}_time`]) < 60000) {
            console.log(`📦 Devolviendo stats del partido ${gameId} desde caché`);
            return res.json(cache[cacheKey]);
        }

        console.log(`🌐 Llamando a BallDontLie para stats del partido ${gameId}...`);
        const response = await fetch(`https://api.balldontlie.io/v1/stats?game_ids[]=${gameId}&per_page=100`, {
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Guardamos en caché
        cache[cacheKey] = data;
        cache[`${cacheKey}_time`] = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error stats:', error.message);
        res.status(500).json({ error: 'Error al obtener stats de jugadores' });
    }
});

// ============ BUSCAR PARTIDO EN BALLDONTLIE POR EQUIPOS Y FECHA ============
app.get('/api/balldontlie/game', async (req, res) => {
    try {
        const { date, team1, team2 } = req.query;
        
        console.log(`🔍 Buscando partido en BallDontLie: ${team1} vs ${team2} - ${date}`);
        
        const response = await fetch(`https://api.balldontlie.io/v1/games?dates[]=${date}&per_page=50`, {
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Buscar el partido que coincida con los equipos
        const game = data.data.find(g => {
            const homeAbbr = g.home_team.abbreviation.toLowerCase();
            const visitorAbbr = g.visitor_team.abbreviation.toLowerCase();
            const t1 = team1.toLowerCase();
            const t2 = team2.toLowerCase();
            return (homeAbbr === t1 && visitorAbbr === t2) || 
                   (homeAbbr === t2 && visitorAbbr === t1);
        });

        if (game) {
            res.json({ found: true, game });
        } else {
            res.json({ found: false, message: 'Partido no encontrado en BallDontLie' });
        }
    } catch (error) {
        console.error('Error buscando partido:', error.message);
        res.status(500).json({ error: 'Error al buscar partido' });
    }
});

// ============ NBA CDN - SCOREBOARD PARA OBTENER GAME IDs ============
app.get('/api/nba/scoreboard', async (req, res) => {
    try {
        const now = Date.now();
        
        // Caché de 15 segundos
        if (cache.nbaScoreboard && (now - cache.nbaScoreboardTimestamp) < 15000) {
            console.log('📦 Devolviendo scoreboard NBA CDN desde caché');
            return res.json(cache.nbaScoreboard);
        }

        console.log('🌐 Llamando a NBA CDN scoreboard...');
        const response = await fetch('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        cache.nbaScoreboard = data;
        cache.nbaScoreboardTimestamp = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error NBA CDN scoreboard:', error.message);
        res.status(500).json({ error: 'Error al obtener scoreboard de NBA' });
    }
});

// ============ NBA CDN - BOX SCORE EN VIVO ============
app.get('/api/nba/boxscore/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const cacheKey = `nba_boxscore_${gameId}`;
        const now = Date.now();
        
        // Caché de 10 segundos para stats en vivo
        if (cache[cacheKey] && (now - cache[`${cacheKey}_time`]) < 10000) {
            console.log(`📦 Devolviendo boxscore ${gameId} desde caché`);
            return res.json(cache[cacheKey]);
        }

        console.log(`🌐 Llamando a NBA CDN boxscore ${gameId}...`);
        const response = await fetch(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        cache[cacheKey] = data;
        cache[`${cacheKey}_time`] = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error NBA boxscore:', error.message);
        res.status(500).json({ error: 'Error al obtener boxscore de NBA' });
    }
});

// ============ ESPN STANDINGS (CLASIFICACIÓN) ============
app.get('/api/standings', async (req, res) => {
    try {
        const now = Date.now();
        
        // Caché de 5 minutos para standings (no cambian tan rápido)
        if (cache.standings && (now - cache.standingsTimestamp) < 300000) {
            console.log('📦 Devolviendo standings desde caché');
            return res.json(cache.standings);
        }

        console.log('🌐 Llamando a ESPN standings...');
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        cache.standings = data;
        cache.standingsTimestamp = now;
        
        res.json(data);
    } catch (error) {
        console.error('Error standings:', error.message);
        res.status(500).json({ error: 'Error al obtener standings' });
    }
});

app.listen(PORT, () => {
    console.log(`🏀 Servidor NBA corriendo en http://localhost:${PORT}`);
    console.log(`📡 API Key BallDontLie: ${API_KEY ? 'Sí' : 'No'}`);
    console.log(`📺 ESPN API: Activa (sin key)`);
    console.log(`🏆 NBA CDN: Activa (stats en vivo + standings)`);
    console.log(`⏱️  Caché: ${CACHE_DURATION/1000}s | Rate limit: 20 peticiones/min`);
});
