const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Importar base de datos
const db = require('./database');

const app = express();
const PORT = 3000;

// Tu API key está segura aquí en el servidor
const API_KEY = process.env.NBA_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ============ CACHÉ EN MEMORIA ============
// Guarda las respuestas para no llamar a la API cada vez
const cache = {
    games: null,
    recentGames: null,
    gamesTimestamp: 0,
    recentTimestamp: 0
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
app.use(express.json()); // Para leer JSON del body
app.use(limiter);

// ============ MIDDLEWARE: Verificar JWT ============
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Inicia sesión.' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
}

// ============ REGISTRO (SIGN UP) ============
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validaciones
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        // Verificar si ya existe
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario o email ya están registrados.' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar usuario
        const result = db.prepare(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
        ).run(username, email, hashedPassword);

        // Crear token JWT
        const token = jwt.sign(
            { id: result.lastInsertRowid, username, email, plan: 'free' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Nuevo usuario registrado: ${username}`);

        res.status(201).json({
            message: '¡Cuenta creada con éxito!',
            token,
            user: {
                id: result.lastInsertRowid,
                username,
                email,
                plan: 'free',
                coins: 1000,
                avatar: '🏀'
            }
        });

    } catch (error) {
        console.error('Error en signup:', error.message);
        res.status(500).json({ error: 'Error al crear la cuenta.' });
    }
});

// ============ LOGIN ============
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
        }

        // Buscar usuario
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
        }

        // Crear token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, plan: user.plan },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`🔑 Login exitoso: ${user.username}`);

        res.json({
            message: '¡Bienvenido de vuelta!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                plan: user.plan,
                coins: user.coins,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
});

// ============ PERFIL (requiere login) ============
app.get('/api/profile', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT id, username, email, plan, coins, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ user });
});

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

app.listen(PORT, () => {
    console.log(`🏀 Servidor NBA corriendo en http://localhost:${PORT}`);
    console.log(`📡 API Key configurada: ${API_KEY ? 'Sí' : 'No'}`);
    console.log(`⏱️  Caché: ${CACHE_DURATION/1000}s | Rate limit: 20 peticiones/min`);
});
