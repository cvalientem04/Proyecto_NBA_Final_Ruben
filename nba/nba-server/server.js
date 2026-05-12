const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

async function sendEmail(to, subject, html) {
    await mailer.sendMail({ from: `"NBA LIVE" <${process.env.GMAIL_USER}>`, to, subject, html });
}

async function translateText(text) {
    if (!text || text.length < 3) return text;
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|es&de=${encodeURIComponent(process.env.GMAIL_USER || '')}`;
        const res = await fetch(url);
        if (!res.ok) return text;
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        return (translated && !translated.includes('MYMEMORY WARNING')) ? translated : text;
    } catch {
        return text;
    }
}

// Importar base de datos
const db = require('./database');

const app = express();
const PORT = 3000;

// Tu API key está segura aquí en el servidor
const API_KEY = process.env.NBA_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const NBA_CDN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.nba.com/'
};

async function fetchNbaCdn(url) {
    return fetch(url, { headers: NBA_CDN_HEADERS });
}

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
    standingsTimestamp: 0,
    playoffBracket: null,
    playoffBracketTimestamp: 0
};
const CACHE_DURATION = 30000; // 30 segundos

// Catálogo estático de equipos NBA (id de BallDontLie + id oficial NBA para logo).
const NBA_TEAMS_CATALOG = [
    { blTeamId: 1,  abbr: 'ATL', city: 'Atlanta',       name: 'Hawks',          nbaTeamId: '1610612737' },
    { blTeamId: 2,  abbr: 'BOS', city: 'Boston',        name: 'Celtics',        nbaTeamId: '1610612738' },
    { blTeamId: 3,  abbr: 'BKN', city: 'Brooklyn',      name: 'Nets',           nbaTeamId: '1610612751' },
    { blTeamId: 4,  abbr: 'CHA', city: 'Charlotte',     name: 'Hornets',        nbaTeamId: '1610612766' },
    { blTeamId: 5,  abbr: 'CHI', city: 'Chicago',       name: 'Bulls',          nbaTeamId: '1610612741' },
    { blTeamId: 6,  abbr: 'CLE', city: 'Cleveland',     name: 'Cavaliers',      nbaTeamId: '1610612739' },
    { blTeamId: 7,  abbr: 'DAL', city: 'Dallas',        name: 'Mavericks',      nbaTeamId: '1610612742' },
    { blTeamId: 8,  abbr: 'DEN', city: 'Denver',        name: 'Nuggets',        nbaTeamId: '1610612743' },
    { blTeamId: 9,  abbr: 'DET', city: 'Detroit',       name: 'Pistons',        nbaTeamId: '1610612765' },
    { blTeamId: 10, abbr: 'GSW', city: 'Golden State',  name: 'Warriors',       nbaTeamId: '1610612744' },
    { blTeamId: 11, abbr: 'HOU', city: 'Houston',       name: 'Rockets',        nbaTeamId: '1610612745' },
    { blTeamId: 12, abbr: 'IND', city: 'Indiana',       name: 'Pacers',         nbaTeamId: '1610612754' },
    { blTeamId: 13, abbr: 'LAC', city: 'LA',            name: 'Clippers',       nbaTeamId: '1610612746' },
    { blTeamId: 14, abbr: 'LAL', city: 'Los Angeles',   name: 'Lakers',         nbaTeamId: '1610612747' },
    { blTeamId: 15, abbr: 'MEM', city: 'Memphis',       name: 'Grizzlies',      nbaTeamId: '1610612763' },
    { blTeamId: 16, abbr: 'MIA', city: 'Miami',         name: 'Heat',           nbaTeamId: '1610612748' },
    { blTeamId: 17, abbr: 'MIL', city: 'Milwaukee',     name: 'Bucks',          nbaTeamId: '1610612749' },
    { blTeamId: 18, abbr: 'MIN', city: 'Minnesota',     name: 'Timberwolves',   nbaTeamId: '1610612750' },
    { blTeamId: 19, abbr: 'NOP', city: 'New Orleans',   name: 'Pelicans',       nbaTeamId: '1610612740' },
    { blTeamId: 20, abbr: 'NYK', city: 'New York',      name: 'Knicks',         nbaTeamId: '1610612752' },
    { blTeamId: 21, abbr: 'OKC', city: 'Oklahoma City', name: 'Thunder',        nbaTeamId: '1610612760' },
    { blTeamId: 22, abbr: 'ORL', city: 'Orlando',       name: 'Magic',          nbaTeamId: '1610612753' },
    { blTeamId: 23, abbr: 'PHI', city: 'Philadelphia',  name: '76ers',          nbaTeamId: '1610612755' },
    { blTeamId: 24, abbr: 'PHX', city: 'Phoenix',       name: 'Suns',           nbaTeamId: '1610612756' },
    { blTeamId: 25, abbr: 'POR', city: 'Portland',      name: 'Trail Blazers',  nbaTeamId: '1610612757' },
    { blTeamId: 26, abbr: 'SAC', city: 'Sacramento',    name: 'Kings',          nbaTeamId: '1610612758' },
    { blTeamId: 27, abbr: 'SAS', city: 'San Antonio',   name: 'Spurs',          nbaTeamId: '1610612759' },
    { blTeamId: 28, abbr: 'TOR', city: 'Toronto',       name: 'Raptors',        nbaTeamId: '1610612761' },
    { blTeamId: 29, abbr: 'UTA', city: 'Utah',          name: 'Jazz',           nbaTeamId: '1610612762' },
    { blTeamId: 30, abbr: 'WAS', city: 'Washington',    name: 'Wizards',        nbaTeamId: '1610612764' }
];

function buildTeamLogoUrl(nbaTeamId) {
    return `https://cdn.nba.com/logos/nba/${nbaTeamId}/global/L/logo.svg`;
}

function buildStatLookup(statCategories) {
    const lookup = {};
    if (!Array.isArray(statCategories)) return lookup;

    statCategories.forEach(category => {
        const statsArray = Array.isArray(category?.stats) ? category.stats : [];
        statsArray.forEach(stat => {
            if (!stat) return;

            if (typeof stat.name === 'string' && !(stat.name in lookup)) {
                lookup[stat.name] = stat;
            }

            if (typeof stat.abbreviation === 'string' && !(stat.abbreviation in lookup)) {
                lookup[stat.abbreviation] = stat;
            }
        });
    });

    return lookup;
}

function getNumericStatValue(lookup, keys) {
    const safeKeys = Array.isArray(keys) ? keys : [keys];

    for (const key of safeKeys) {
        if (!key || !lookup[key]) continue;

        const numericValue = Number(lookup[key].value);
        if (Number.isFinite(numericValue)) {
            return numericValue;
        }

        const displayNumericValue = Number(lookup[key].displayValue);
        if (Number.isFinite(displayNumericValue)) {
            return displayNumericValue;
        }
    }

    return null;
}

const ESPN_TO_NBA_ABBR = {
    WSH: 'WAS',
    NY: 'NYK',
    GS: 'GSW',
    SA: 'SAS',
    NO: 'NOP',
    UTAH: 'UTA'
};

function normalizeTeamAbbr(value) {
    const raw = String(value || '').trim().toUpperCase();
    return ESPN_TO_NBA_ABBR[raw] || raw;
}

function normalizePersonName(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function findTeamInCatalogByAbbr(abbr) {
    const normalizedAbbr = normalizeTeamAbbr(abbr);
    return NBA_TEAMS_CATALOG.find(team => team.abbr === normalizedAbbr) || null;
}

function mapEspnLeaderToPlayer(leader, team, seasonLabel) {
    const athlete = leader?.athlete || {};
    const fullName = athlete.displayName || athlete.shortName || 'Jugador NBA';
    const nameParts = String(fullName).trim().split(/\s+/);
    const firstName = nameParts.shift() || fullName;
    const lastName = nameParts.join(' ');
    const statLookup = buildStatLookup(leader?.statistics);

    return {
        id: Number(athlete.id) || null,
        name: fullName,
        nameKey: normalizePersonName(fullName),
        first_name: firstName,
        last_name: lastName,
        teamAbbr: team.abbr,
        teamName: `${team.city} ${team.name}`,
        position: athlete?.position?.abbreviation || '-',
        headshot: athlete?.headshot?.href || null,
        season: seasonLabel,
        season_stats: {
            games_played: getNumericStatValue(statLookup, ['gamesPlayed', 'GP']),
            pts: getNumericStatValue(statLookup, ['avgPoints', 'PTS']),
            reb: getNumericStatValue(statLookup, ['avgRebounds', 'REB']),
            ast: getNumericStatValue(statLookup, ['avgAssists', 'AST']),
            stl: getNumericStatValue(statLookup, ['avgSteals', 'STL']),
            blk: getNumericStatValue(statLookup, ['avgBlocks', 'BLK']),
            min: getNumericStatValue(statLookup, ['avgMinutes', 'MIN']),
            fg_pct: getNumericStatValue(statLookup, ['fieldGoalPct', 'FG%']),
            fg3_pct: getNumericStatValue(statLookup, ['threePointFieldGoalPct', '3P%']),
            ft_pct: getNumericStatValue(statLookup, ['freeThrowPct', 'FT%'])
        }
    };
}

function buildNextGameFromEspnEvent(event, teamAbbr) {
    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const normalizedTeamAbbr = normalizeTeamAbbr(teamAbbr);

    const teamCompetitor = competitors.find(
        competitor => normalizeTeamAbbr(competitor?.team?.abbreviation) === normalizedTeamAbbr
    );

    if (!teamCompetitor) return null;

    const opponentCompetitor = competitors.find(competitor => competitor !== teamCompetitor) || null;

    return {
        teamAbbr: normalizedTeamAbbr,
        gameId: String(event?.id || ''),
        gameDate: event?.date || null,
        shortName: event?.shortName || '',
        status: event?.status?.type?.description || event?.status?.type?.detail || event?.status?.type?.name || 'Scheduled',
        isHome: String(teamCompetitor?.homeAway || '').toLowerCase() === 'home',
        opponentAbbr: normalizeTeamAbbr(opponentCompetitor?.team?.abbreviation || 'NBA'),
        opponentName: opponentCompetitor?.team?.displayName || 'Rival por confirmar'
    };
}

function findTeamInCatalogByNbaTeamId(nbaTeamId) {
    const normalizedId = String(nbaTeamId || '').trim();
    if (!normalizedId) return null;

    return NBA_TEAMS_CATALOG.find(team => String(team.nbaTeamId) === normalizedId) || null;
}

function buildTeamMetaFromScheduleTeam(teamData) {
    const teamId = String(teamData?.teamId || '').trim();
    const catalogTeam = findTeamInCatalogByNbaTeamId(teamId);

    const fallbackName = `${teamData?.teamCity || ''} ${teamData?.teamName || ''}`.trim() || 'Equipo NBA';
    const fallbackAbbr = String(teamData?.teamTricode || teamData?.teamSlug || 'NBA').trim().toUpperCase();

    const wins = Number(teamData?.wins);
    const losses = Number(teamData?.losses);
    const seed = Number(teamData?.seed);

    return {
        teamId: teamId || null,
        name: catalogTeam ? `${catalogTeam.city} ${catalogTeam.name}` : fallbackName,
        abbr: catalogTeam?.abbr || fallbackAbbr,
        seed: Number.isFinite(seed) ? seed : null,
        wins: Number.isFinite(wins) ? wins : null,
        losses: Number.isFinite(losses) ? losses : null,
        logo: teamId ? buildTeamLogoUrl(teamId) : ''
    };
}

function detectPlayoffRoundFromLabel(gameLabel) {
    const normalizedLabel = String(gameLabel || '').toLowerCase();

    if (normalizedLabel.includes('first round')) return 'first_round';
    if (normalizedLabel.includes('semifinals')) return 'semifinals';

    if (
        normalizedLabel.includes('conference finals')
        || normalizedLabel.includes('east finals')
        || normalizedLabel.includes('west finals')
    ) {
        return 'conference_finals';
    }

    if (normalizedLabel.includes('nba finals')) return 'nba_finals';

    return null;
}

function detectPlayoffConferenceFromLabel(roundKey, gameLabel) {
    if (roundKey === 'nba_finals') return 'nba';

    const normalizedLabel = String(gameLabel || '').toLowerCase();
    if (normalizedLabel.includes('east')) return 'east';
    if (normalizedLabel.includes('west')) return 'west';

    return null;
}

function flattenScheduleGames(schedulePayload) {
    const gameDates = Array.isArray(schedulePayload?.leagueSchedule?.gameDates)
        ? schedulePayload.leagueSchedule.gameDates
        : [];

    const allGames = [];

    gameDates.forEach(gameDate => {
        if (!Array.isArray(gameDate?.games)) return;
        allGames.push(...gameDate.games);
    });

    return allGames;
}

// ============ RATE LIMITING ============
// Limita peticiones por IP para evitar abusos
// El servidor tiene caché propia, así que las APIs externas están protegidas
// independientemente de cuántas veces llame el usuario al servidor.
const limiter = rateLimit({
    windowMs: 60 * 1000,  // Ventana de 1 minuto
    max: 100,             // 100 peticiones/min: auto-refresh (4/min) + uso normal holgado
    message: { error: 'Demasiadas peticiones. Espera un momento.', retryAfter: 15 },
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

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
}

// ============ REGISTRO (SIGN UP) ============
// Helper: enviar email de verificación
async function sendVerificationEmail(userId, username, email) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await db.query(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, expiresAt]
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/nba';
    const verifyLink = `${frontendUrl}/verify-email.html?token=${token}`;
    await sendEmail(email, '🏀 NBA LIVE — Verifica tu email',
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#1d1d1d;color:#fff;border-radius:12px;padding:32px">
            <h1 style="color:#e03a3e;margin-bottom:8px">NBA LIVE</h1>
            <p>Hola <strong>${username}</strong>,</p>
            <p>Gracias por registrarte. Haz clic en el botón para verificar tu email y acceder a la cancha:</p>
            <a href="${verifyLink}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#e03a3e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Verificar email</a>
            <p style="color:#888;font-size:13px">El enlace expira en 24 horas. Si no te registraste en NBA LIVE, ignora este correo.</p>
        </div>`);
}

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
        const existingUserResult = await db.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (existingUserResult.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario o email ya están registrados.' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar usuario
        const result = await db.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );

        const newUserId = result.rows[0].id;
        console.log(`✅ Nuevo usuario registrado: ${username}`);

        // Enviar email de verificación (no bloqueante)
        sendVerificationEmail(newUserId, username, email).catch(err =>
            console.error('Error enviando email de verificación:', err.message)
        );

        res.status(201).json({
            message: 'Cuenta creada. Revisa tu email para verificar tu cuenta antes de entrar.'
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
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
        }

        // Verificar si está baneado
        if (user.banned) {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta con el administrador.' });
        }

        // Verificar si el email está confirmado
        if (!user.email_verified) {
            return res.status(403).json({
                error: 'Debes verificar tu email antes de entrar. Revisa tu bandeja de entrada.',
                unverified: true
            });
        }

        // Crear token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, plan: user.plan, role: user.role || 'user' },
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
                avatar: user.avatar,
                role: user.role || 'user'
            }
        });

    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
});

// ============ RECUPERAR CONTRASEÑA ============

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido.' });

    try {
        const userResult = await db.query('SELECT id, username FROM users WHERE email = $1', [email]);
        // Respuesta genérica para no revelar si el email existe
        if (userResult.rows.length === 0) {
            return res.json({ message: 'Si ese email existe, recibirás un enlace en breve.' });
        }
        const user = userResult.rows[0];

        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5502/nba';
        const resetLink = `${frontendUrl}/reset-password.html?token=${token}`;

        await sendEmail(email, '🏀 NBA LIVE — Recuperar contraseña',
            `<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#1d1d1d;color:#fff;border-radius:12px;padding:32px">
                <h1 style="color:#e03a3e;margin-bottom:8px">NBA LIVE</h1>
                <p>Hola <strong>${user.username}</strong>,</p>
                <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón antes de que expire (1 hora):</p>
                <a href="${resetLink}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#e03a3e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Restablecer contraseña</a>
                <p style="color:#888;font-size:13px">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>
            </div>`);

        res.json({ message: 'Si ese email existe, recibirás un enlace en breve.' });
    } catch (error) {
        console.error('Error en forgot-password:', error.message);
        res.status(500).json({ error: 'Error al procesar la solicitud.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos.' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    try {
        const tokenResult = await db.query(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
            [token]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'El enlace no es válido o ha expirado.' });
        }
        const resetToken = tokenResult.rows[0];

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
        await db.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

        res.json({ message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        console.error('Error en reset-password:', error.message);
        res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
});

// ============ VERIFICACIÓN DE EMAIL ============

app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido.' });
    try {
        const tokenResult = await db.query(
            'SELECT * FROM email_verification_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
            [token]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'El enlace no es válido o ha expirado.' });
        }
        const { user_id, id } = tokenResult.rows[0];
        await db.query('UPDATE users SET email_verified = true WHERE id = $1', [user_id]);
        await db.query('UPDATE email_verification_tokens SET used = true WHERE id = $1', [id]);
        res.json({ message: '¡Email verificado! Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error('Error en verify-email:', error.message);
        res.status(500).json({ error: 'Error al verificar el email.' });
    }
});

app.post('/api/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido.' });
    try {
        const userResult = await db.query(
            'SELECT id, username, email_verified FROM users WHERE email = $1', [email]
        );
        if (userResult.rows.length === 0 || userResult.rows[0].email_verified) {
            return res.json({ message: 'Si el email existe y no está verificado, recibirás un nuevo enlace.' });
        }
        const user = userResult.rows[0];
        await sendVerificationEmail(user.id, user.username || 'Usuario', email);
        res.json({ message: 'Email de verificación reenviado. Revisa tu bandeja de entrada.' });
    } catch (error) {
        console.error('Error en resend-verification:', error.message);
        res.status(500).json({ error: 'Error al reenviar el email.' });
    }
});

// ============ PERFIL (requiere login) ============
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, email, plan, coins, avatar, role, banned, created_at FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error en profile:', error.message);
        res.status(500).json({ error: 'Error al obtener el perfil.' });
    }
});

// ============ REVIEWS (PÚBLICAS - TODOS PUEDEN VER) ============
app.get('/api/reviews', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.id, r.user_id, r.name, r.rating, r.comment, r.created_at,
                   uc.active_title,
                   b.icon_emoji AS badge_emoji,
                   c.color_hex  AS username_color,
                   f.icon_emoji AS frame_emoji
            FROM reviews r
            LEFT JOIN user_cosmetics uc ON r.user_id = uc.user_id
            LEFT JOIN shop_items b ON uc.equipped_badge_id = b.id
            LEFT JOIN shop_items c ON uc.equipped_color_id = c.id
            LEFT JOIN shop_items f ON uc.equipped_frame_id = f.id
            ORDER BY r.created_at DESC
            LIMIT 50
        `);
        res.json({ reviews: result.rows });
    } catch (error) {
        console.error('Error GET /api/reviews:', error.message);
        res.status(500).json({ error: 'Error al obtener reseñas.' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { name, rating, comment } = req.body;

        if (!name || name.length < 2) {
            return res.status(400).json({ error: 'Nombre debe tener al menos 2 caracteres.' });
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Valoración debe ser de 1 a 5.' });
        }
        if (!comment || comment.length < 10) {
            return res.status(400).json({ error: 'La reseña debe tener al menos 10 caracteres.' });
        }

        // Intentar extraer user_id del token JWT si existe
        let userId = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            } catch (e) { /* Token inválido, se guarda sin user_id */ }
        }

        const result = await db.query(
            'INSERT INTO reviews (user_id, name, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, rating, comment, created_at',
            [userId, name.slice(0, 30), rating, comment.slice(0, 280)]
        );

        console.log(`⭐ Nueva reseña de: ${name} (${rating}/5)`);
        res.status(201).json({ review: result.rows[0] });
    } catch (error) {
        console.error('Error POST /api/reviews:', error.message);
        res.status(500).json({ error: 'Error al publicar la reseña.' });
    }
});

// ============ BORRAR RESEÑA (SOLO ADMIN) ============
app.delete('/api/reviews/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const reviewId = Number(req.params.id);
        if (!Number.isInteger(reviewId) || reviewId < 1) {
            return res.status(400).json({ error: 'ID de reseña inválido.' });
        }
        const existing = await db.query('SELECT id FROM reviews WHERE id = $1', [reviewId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada.' });
        }
        await db.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
        console.log(`🗑️ Admin ${req.user.username} eliminó la reseña ${reviewId}`);
        res.json({ message: 'Reseña eliminada.' });
    } catch (error) {
        console.error('Error DELETE /api/reviews/:id:', error.message);
        res.status(500).json({ error: 'Error al eliminar la reseña.' });
    }
});

// ============ FAVORITOS (REQUIERE LOGIN) ============
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const teamsResult = await db.query(
            'SELECT id, team_abbr, team_name, added_at FROM favorites_teams WHERE user_id = $1 ORDER BY team_name',
            [req.user.id]
        );
        const playersResult = await db.query(
            'SELECT id, player_id, player_name, team_abbr, added_at FROM favorites_players WHERE user_id = $1 ORDER BY player_name',
            [req.user.id]
        );
        res.json({
            teams: teamsResult.rows,
            players: playersResult.rows
        });
    } catch (error) {
        console.error('Error GET /api/favorites:', error.message);
        res.status(500).json({ error: 'Error al obtener favoritos.' });
    }
});

app.post('/api/favorites/team', authenticateToken, async (req, res) => {
    try {
        const { team_abbr, team_name } = req.body;
        if (!team_abbr || !team_name) {
            return res.status(400).json({ error: 'team_abbr y team_name son obligatorios.' });
        }

        await db.query(
            'INSERT INTO favorites_teams (user_id, team_abbr, team_name) VALUES ($1, $2, $3) ON CONFLICT (user_id, team_abbr) DO NOTHING',
            [req.user.id, team_abbr.toUpperCase(), team_name]
        );
        res.status(201).json({ message: `${team_name} añadido a favoritos.` });
    } catch (error) {
        console.error('Error POST /api/favorites/team:', error.message);
        res.status(500).json({ error: 'Error al añadir equipo favorito.' });
    }
});

app.delete('/api/favorites/team/:abbr', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM favorites_teams WHERE user_id = $1 AND team_abbr = $2',
            [req.user.id, req.params.abbr.toUpperCase()]
        );
        res.json({ message: 'Equipo eliminado de favoritos.' });
    } catch (error) {
        console.error('Error DELETE /api/favorites/team:', error.message);
        res.status(500).json({ error: 'Error al eliminar equipo favorito.' });
    }
});

app.post('/api/favorites/player', authenticateToken, async (req, res) => {
    try {
        const { player_name, player_id, team_abbr } = req.body;
        if (!player_name) {
            return res.status(400).json({ error: 'player_name es obligatorio.' });
        }

        const finalPlayerId = player_id || player_name.toLowerCase().replace(/\s+/g, '_');

        await db.query(
            'INSERT INTO favorites_players (user_id, player_id, player_name, team_abbr) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, player_id) DO NOTHING',
            [req.user.id, finalPlayerId, player_name, team_abbr || null]
        );
        res.status(201).json({ message: `${player_name} añadido a favoritos.` });
    } catch (error) {
        console.error('Error POST /api/favorites/player:', error.message);
        res.status(500).json({ error: 'Error al añadir jugador favorito.' });
    }
});

app.delete('/api/favorites/player/:playerId', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM favorites_players WHERE user_id = $1 AND player_id = $2',
            [req.user.id, req.params.playerId]
        );
        res.json({ message: 'Jugador eliminado de favoritos.' });
    } catch (error) {
        console.error('Error DELETE /api/favorites/player:', error.message);
        res.status(500).json({ error: 'Error al eliminar jugador favorito.' });
    }
});

// ============ MINIGAME SCORES ============
app.post('/api/minigame-score', authenticateToken, async (req, res) => {
    try {
        const { game_type, score } = req.body;
        if (!game_type || score === undefined) {
            return res.status(400).json({ error: 'game_type y score son obligatorios.' });
        }

        await db.query(
            'INSERT INTO minigame_scores (user_id, game_type, score) VALUES ($1, $2, $3)',
            [req.user.id, game_type, score]
        );
        res.status(201).json({ message: 'Puntuación guardada.' });
    } catch (error) {
        console.error('Error POST /api/minigame-score:', error.message);
        res.status(500).json({ error: 'Error al guardar puntuación.' });
    }
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

        const normalizedT1 = (team1 || '').toLowerCase();
        const normalizedT2 = (team2 || '').toLowerCase();
        const cacheKey = `bdl_game_${date}_${[normalizedT1, normalizedT2].sort().join('_')}`;
        const now = Date.now();

        if (cache[cacheKey] !== undefined && (now - cache[`${cacheKey}_time`]) < 60000) {
            console.log(`📦 Devolviendo partido BallDontLie desde caché (${team1} vs ${team2})`);
            return res.json(cache[cacheKey]);
        }

        console.log(`🌐 Buscando partido en BallDontLie: ${team1} vs ${team2} - ${date}`);

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
            return (homeAbbr === normalizedT1 && visitorAbbr === normalizedT2) ||
                   (homeAbbr === normalizedT2 && visitorAbbr === normalizedT1);
        });

        const result = game ? { found: true, game } : { found: false, message: 'Partido no encontrado en BallDontLie' };

        cache[cacheKey] = result;
        cache[`${cacheKey}_time`] = now;

        res.json(result);
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
        const response = await fetchNbaCdn('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');

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
        const response = await fetchNbaCdn(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`);

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

// ============ TODOS LOS EQUIPOS NBA (para página Steams) ============
app.get('/api/teams/all', (req, res) => {
    const teams = NBA_TEAMS_CATALOG
        .map(team => ({
            ...team,
            fullName: `${team.city} ${team.name}`,
            logo: buildTeamLogoUrl(team.nbaTeamId)
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

    res.json({ data: teams });
});

// ============ JUGADORES + STATS DE TEMPORADA POR EQUIPO ============
app.get('/api/teams/:teamId/players-stats', async (req, res) => {
    try {
        const teamId = Number(req.params.teamId);

        if (!Number.isInteger(teamId) || teamId < 1 || teamId > 30) {
            return res.status(400).json({ error: 'teamId inválido.' });
        }

        const team = NBA_TEAMS_CATALOG.find(t => t.blTeamId === teamId);
        if (!team) {
            return res.status(404).json({ error: 'Equipo no encontrado.' });
        }

        const teamCode = String(team.abbr || '').toLowerCase();
        const cacheKey = `espn_team_${teamCode}_athletes_stats`;
        const cacheTimeKey = `${cacheKey}_time`;
        const now = Date.now();

        let espnData = null;
        if (cache[cacheKey] && (now - cache[cacheTimeKey]) < 300000) {
            espnData = cache[cacheKey];
        } else {
            const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamCode}/athletes/statistics`;
            const statsResponse = await fetch(statsUrl);

            if (!statsResponse.ok) {
                throw new Error(`Error ${statsResponse.status}: ${statsResponse.statusText}`);
            }

            espnData = await statsResponse.json();
            cache[cacheKey] = espnData;
            cache[cacheTimeKey] = now;
        }

        const seasonLabel = espnData?.requestedSeason?.displayName
            || espnData?.season?.displayName
            || 'Temporada actual';

        const resultEntry = Array.isArray(espnData?.results)
            ? espnData.results[0]
            : espnData?.results;

        const leaders = Array.isArray(resultEntry?.leaders) ? resultEntry.leaders : [];

        let playersWithStats = leaders.map(leader => {
            const athlete = leader?.athlete || {};
            const fullName = athlete.displayName || athlete.shortName || 'Jugador NBA';
            const nameParts = String(fullName).trim().split(/\s+/);
            const firstName = nameParts.shift() || fullName;
            const lastName = nameParts.join(' ');

            const statLookup = buildStatLookup(leader?.statistics);

            return {
                id: Number(athlete.id) || null,
                first_name: firstName,
                last_name: lastName,
                position: athlete?.position?.abbreviation || '-',
                headshot: athlete?.headshot?.href || null,
                season_stats: {
                    games_played: getNumericStatValue(statLookup, ['gamesPlayed', 'GP']),
                    pts: getNumericStatValue(statLookup, ['avgPoints', 'PTS']),
                    reb: getNumericStatValue(statLookup, ['avgRebounds', 'REB']),
                    ast: getNumericStatValue(statLookup, ['avgAssists', 'AST']),
                    stl: getNumericStatValue(statLookup, ['avgSteals', 'STL']),
                    blk: getNumericStatValue(statLookup, ['avgBlocks', 'BLK']),
                    min: getNumericStatValue(statLookup, ['avgMinutes', 'MIN']),
                    fg_pct: getNumericStatValue(statLookup, ['fieldGoalPct', 'FG%']),
                    fg3_pct: getNumericStatValue(statLookup, ['threePointFieldGoalPct', '3P%']),
                    ft_pct: getNumericStatValue(statLookup, ['freeThrowPct', 'FT%'])
                }
            };
        });

        if (playersWithStats.length === 0) {
            const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamCode}/roster`;
            const rosterResponse = await fetch(rosterUrl);

            if (rosterResponse.ok) {
                const rosterData = await rosterResponse.json();
                const athletes = Array.isArray(rosterData?.athletes) ? rosterData.athletes : [];

                playersWithStats = athletes.map(athlete => ({
                    id: Number(athlete.id) || null,
                    first_name: athlete.firstName || athlete.displayName || 'Jugador',
                    last_name: athlete.lastName || '',
                    position: athlete?.position?.abbreviation || '-',
                    headshot: athlete?.headshot?.href || null,
                    season_stats: null
                }));
            }
        }

        playersWithStats.sort((a, b) => {
            const pointsA = Number(a?.season_stats?.pts || 0);
            const pointsB = Number(b?.season_stats?.pts || 0);
            return pointsB - pointsA;
        });

        res.json({
            team: {
                ...team,
                fullName: `${team.city} ${team.name}`,
                logo: buildTeamLogoUrl(team.nbaTeamId)
            },
            season: seasonLabel,
            data: playersWithStats
        });
    } catch (error) {
        console.error('Error /api/teams/:teamId/players-stats:', error.message);
        res.status(500).json({ error: 'Error al obtener jugadores y stats del equipo.' });
    }
});

// ============ PRÓXIMOS PARTIDOS POR EQUIPOS ============
app.get('/api/teams/next-games', async (req, res) => {
    try {
        const abbrsRaw = String(req.query.abbrs || '');
        const requestedAbbrs = [...new Set(
            abbrsRaw
                .split(',')
                .map(abbr => normalizeTeamAbbr(abbr))
                .filter(Boolean)
        )];

        if (requestedAbbrs.length === 0) {
            return res.status(400).json({ error: 'Debes indicar abbrs, por ejemplo: ?abbrs=LAL,BOS' });
        }

        const daysRaw = Number(req.query.days);
        const daysToSearch = Number.isFinite(daysRaw)
            ? Math.min(Math.max(Math.trunc(daysRaw), 1), 14)
            : 7;

        const cacheKey = `next_games_${requestedAbbrs.join('_')}_${daysToSearch}`;
        const cacheTimeKey = `${cacheKey}_time`;
        const now = Date.now();

        if (cache[cacheKey] && (now - cache[cacheTimeKey]) < 300000) {
            return res.json(cache[cacheKey]);
        }

        const foundByAbbr = {};

        for (let offset = 0; offset < daysToSearch; offset += 1) {
            if (requestedAbbrs.every(abbr => foundByAbbr[abbr])) {
                break;
            }

            const date = new Date();
            date.setDate(date.getDate() + offset);
            const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`);
            if (!response.ok) {
                continue;
            }

            const data = await response.json();
            const events = Array.isArray(data?.events) ? data.events : [];

            for (const event of events) {
                for (const abbr of requestedAbbrs) {
                    if (foundByAbbr[abbr]) continue;

                    const nextGame = buildNextGameFromEspnEvent(event, abbr);
                    if (nextGame) {
                        foundByAbbr[abbr] = nextGame;
                    }
                }
            }
        }

        const payload = {
            searchedDays: daysToSearch,
            data: requestedAbbrs
                .map(abbr => foundByAbbr[abbr] || null)
                .filter(Boolean)
        };

        cache[cacheKey] = payload;
        cache[cacheTimeKey] = now;

        res.json(payload);
    } catch (error) {
        console.error('Error /api/teams/next-games:', error.message);
        res.status(500).json({ error: 'Error al obtener proximos partidos.' });
    }
});

// ============ STATS DE JUGADORES FAVORITOS POR NOMBRE ============
app.get('/api/players/stats', async (req, res) => {
    try {
        const namesRaw = String(req.query.names || '');
        const requestedNames = namesRaw
            .split(',')
            .map(name => String(name || '').trim())
            .filter(Boolean)
            .slice(0, 40);

        if (requestedNames.length === 0) {
            return res.status(400).json({ error: 'Debes indicar names, por ejemplo: ?names=Luka%20Doncic,LeBron%20James' });
        }

        const now = Date.now();
        const foundByNameKey = new Map();
        const unresolvedNameKeys = new Set();

        for (const name of requestedNames) {
            const nameKey = normalizePersonName(name);
            if (!nameKey) continue;

            const cacheKey = `favorite_player_stats_${nameKey}`;
            const cacheTimeKey = `${cacheKey}_time`;

            if (cache[cacheKey] && (now - cache[cacheTimeKey]) < 1800000) {
                foundByNameKey.set(nameKey, cache[cacheKey]);
            } else {
                unresolvedNameKeys.add(nameKey);
            }
        }

        for (const team of NBA_TEAMS_CATALOG) {
            if (unresolvedNameKeys.size === 0) break;

            const teamCode = String(team.abbr || '').toLowerCase();
            const teamCacheKey = `espn_team_${teamCode}_athletes_stats`;
            const teamCacheTimeKey = `${teamCacheKey}_time`;

            let espnData = null;
            if (cache[teamCacheKey] && (now - cache[teamCacheTimeKey]) < 300000) {
                espnData = cache[teamCacheKey];
            } else {
                const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamCode}/athletes/statistics`;
                const statsResponse = await fetch(statsUrl);

                if (!statsResponse.ok) {
                    continue;
                }

                espnData = await statsResponse.json();
                cache[teamCacheKey] = espnData;
                cache[teamCacheTimeKey] = now;
            }

            const seasonLabel = espnData?.requestedSeason?.displayName
                || espnData?.season?.displayName
                || 'Temporada actual';

            const resultEntry = Array.isArray(espnData?.results)
                ? espnData.results[0]
                : espnData?.results;

            const leaders = Array.isArray(resultEntry?.leaders) ? resultEntry.leaders : [];

            for (const leader of leaders) {
                const player = mapEspnLeaderToPlayer(leader, team, seasonLabel);
                if (!player?.nameKey || !unresolvedNameKeys.has(player.nameKey)) {
                    continue;
                }

                unresolvedNameKeys.delete(player.nameKey);

                const payload = {
                    id: player.id,
                    name: player.name,
                    first_name: player.first_name,
                    last_name: player.last_name,
                    teamAbbr: player.teamAbbr,
                    teamName: player.teamName,
                    position: player.position,
                    headshot: player.headshot,
                    season: player.season,
                    season_stats: player.season_stats
                };

                foundByNameKey.set(player.nameKey, payload);

                const cacheKey = `favorite_player_stats_${player.nameKey}`;
                cache[cacheKey] = payload;
                cache[`${cacheKey}_time`] = now;
            }
        }

        const responseData = requestedNames.map(name => {
            const nameKey = normalizePersonName(name);
            return foundByNameKey.get(nameKey) || null;
        });

        res.json({ data: responseData });
    } catch (error) {
        console.error('Error /api/players/stats:', error.message);
        res.status(500).json({ error: 'Error al obtener stats de jugadores favoritos.' });
    }
});

// ============ PLAYOFFS BRACKET (RESULTADOS REALES DESDE NBA CDN) ============
app.get('/api/playoffs/bracket', async (req, res) => {
    try {
        const now = Date.now();

        // Caché de 2 minutos para no recalcular toda la temporada en cada llamada
        if (cache.playoffBracket && (now - cache.playoffBracketTimestamp) < 120000) {
            console.log('📦 Devolviendo playoffs bracket desde caché');
            return res.json(cache.playoffBracket);
        }

        console.log('🌐 Llamando a NBA CDN schedule para playoff bracket...');
        const cdnUrl = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_2.json';
        const response = await fetchNbaCdn(cdnUrl);

        if (!response.ok) {
            throw new Error(`NBA CDN devolvió ${response.status} (${response.statusText}) para ${cdnUrl}`);
        }

        const scheduleData = await response.json();
        const allGames = flattenScheduleGames(scheduleData);

        const seriesMap = new Map();

        allGames.forEach(game => {
            const roundKey = detectPlayoffRoundFromLabel(game?.gameLabel);
            if (!roundKey) return;

            const conferenceKey = detectPlayoffConferenceFromLabel(roundKey, game?.gameLabel);
            if (!conferenceKey) return;

            const homeTeam = buildTeamMetaFromScheduleTeam(game?.homeTeam);
            const awayTeam = buildTeamMetaFromScheduleTeam(game?.awayTeam);

            if (!homeTeam.teamId || !awayTeam.teamId) return;

            const homeSeed = Number(homeTeam.seed);
            const awaySeed = Number(awayTeam.seed);

            let teamA = homeTeam;
            let teamB = awayTeam;

            if (Number.isFinite(homeSeed) && Number.isFinite(awaySeed)) {
                if (homeSeed > awaySeed) {
                    teamA = awayTeam;
                    teamB = homeTeam;
                }
            } else if (String(homeTeam.teamId) > String(awayTeam.teamId)) {
                teamA = awayTeam;
                teamB = homeTeam;
            }

            const pairKey = [teamA.teamId, teamB.teamId].sort().join('-');
            const seriesId = `${roundKey}:${conferenceKey}:${pairKey}`;

            if (!seriesMap.has(seriesId)) {
                seriesMap.set(seriesId, {
                    id: seriesId,
                    round: roundKey,
                    conference: conferenceKey,
                    label: String(game?.gameLabel || ''),
                    teamA,
                    teamB,
                    teamAWins: 0,
                    teamBWins: 0,
                    gamesPlayed: 0,
                    totalScheduledGames: 0,
                    latestGameDate: ''
                });
            }

            const series = seriesMap.get(seriesId);

            series.totalScheduledGames += 1;

            const gameDate = String(game?.gameDateUTC || game?.gameDateTimeUTC || game?.gameDateEst || '');
            if (gameDate && (!series.latestGameDate || gameDate > series.latestGameDate)) {
                series.latestGameDate = gameDate;
            }

            const gameStatus = Number(game?.gameStatus);
            const homeScore = Number(game?.homeTeam?.score);
            const awayScore = Number(game?.awayTeam?.score);

            if (gameStatus === 3 && Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
                const winnerTeamId = homeScore > awayScore ? homeTeam.teamId : awayTeam.teamId;

                if (winnerTeamId === series.teamA.teamId) {
                    series.teamAWins += 1;
                } else if (winnerTeamId === series.teamB.teamId) {
                    series.teamBWins += 1;
                }

                series.gamesPlayed += 1;
            }
        });

        const groupedRounds = {
            first_round: { east: [], west: [] },
            semifinals: { east: [], west: [] },
            conference_finals: { east: [], west: [] },
            nba_finals: { nba: [] }
        };

        const normalizedSeries = [...seriesMap.values()].map(series => {
            const isFinished = series.teamAWins >= 4 || series.teamBWins >= 4;
            const winner = isFinished
                ? (series.teamAWins > series.teamBWins ? series.teamA : series.teamB)
                : null;

            return {
                ...series,
                isFinished,
                winnerTeamId: winner?.teamId || null,
                winner
            };
        });

        normalizedSeries.forEach(series => {
            if (!groupedRounds[series.round]) return;
            if (!groupedRounds[series.round][series.conference]) return;

            groupedRounds[series.round][series.conference].push(series);
        });

        const sortSeriesBySeed = (seriesA, seriesB) => {
            const seedA = Number.isFinite(Number(seriesA?.teamA?.seed)) ? Number(seriesA.teamA.seed) : 99;
            const seedB = Number.isFinite(Number(seriesB?.teamA?.seed)) ? Number(seriesB.teamA.seed) : 99;

            if (seedA !== seedB) return seedA - seedB;

            const abbrA = String(seriesA?.teamA?.abbr || '');
            const abbrB = String(seriesB?.teamA?.abbr || '');
            return abbrA.localeCompare(abbrB);
        };

        Object.keys(groupedRounds).forEach(roundKey => {
            const conferences = groupedRounds[roundKey];

            Object.keys(conferences).forEach(conferenceKey => {
                conferences[conferenceKey].sort(sortSeriesBySeed);
            });
        });

        const totalSeries = normalizedSeries.length;
        const finishedSeries = normalizedSeries.filter(series => series.isFinished).length;
        const activeSeries = normalizedSeries.filter(series => !series.isFinished && series.gamesPlayed > 0).length;

        const payload = {
            source: 'NBA CDN scheduleLeagueV2_1',
            seasonYear: scheduleData?.leagueSchedule?.seasonYear || null,
            updatedAt: new Date().toISOString(),
            summary: {
                totalSeries,
                finishedSeries,
                activeSeries
            },
            rounds: groupedRounds
        };

        cache.playoffBracket = payload;
        cache.playoffBracketTimestamp = now;

        res.json(payload);
    } catch (error) {
        console.error('Error /api/playoffs/bracket:', error.message);
        res.status(500).json({ error: `Error al obtener playoff bracket: ${error.message}` });
    }
});

// ============ NOTICIAS ESPN ============
app.get('/api/news', async (req, res) => {
    try {
        const now = Date.now();
        if (cache.espnNews && (now - cache.espnNewsTime) < 300000) {
            return res.json(cache.espnNews);
        }
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news');
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
        const raw = await response.json();

        const rawArticles = Array.isArray(raw?.articles) ? raw.articles.slice(0, 6) : [];
        const articles = await Promise.all(rawArticles.map(async article => {
            const [headline, description] = await Promise.all([
                translateText(article.headline || ''),
                translateText(article.description || '')
            ]);
            return { ...article, headline, description };
        }));

        const processed = { articles };
        cache.espnNews = processed;
        cache.espnNewsTime = now;
        res.json(processed);
    } catch (error) {
        console.error('Error /api/news:', error.message);
        res.status(500).json({ error: 'Error al obtener noticias de ESPN.' });
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

// ============ SINCRONIZAR MONEDAS (USUARIO AUTENTICADO) ============
app.patch('/api/users/coins', authenticateToken, async (req, res) => {
    try {
        const coins = Number(req.body.coins);
        if (!Number.isFinite(coins) || coins < 0) {
            return res.status(400).json({ error: 'Cantidad de monedas inválida.' });
        }
        const safeCoins = Math.floor(coins);
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [safeCoins, req.user.id]);
        res.json({ message: 'Monedas sincronizadas.', coins: safeCoins });
    } catch (error) {
        console.error('Error PATCH /api/users/coins:', error.message);
        res.status(500).json({ error: 'Error al sincronizar monedas.' });
    }
});

// ============ CAMBIAR CONTRASEÑA (USUARIO AUTENTICADO) ============
app.patch('/api/users/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }
        const userResult = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
        console.log(`🔒 Usuario ${req.user.username} cambió su contraseña`);
        res.json({ message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        console.error('Error PATCH /api/users/password:', error.message);
        res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    }
});

// ============ ADMIN: LISTA DE USUARIOS ============
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, plan, coins, role, banned, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error GET /api/admin/users:', error.message);
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
});

// ============ ADMIN: BANEAR / DESBANEAR USUARIO ============
app.patch('/api/admin/users/:id/ban', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(400).json({ error: 'ID de usuario inválido.' });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'No puedes banearte a ti mismo.' });
        }
        const { banned } = req.body;
        if (typeof banned !== 'boolean') {
            return res.status(400).json({ error: 'El campo banned debe ser true o false.' });
        }
        await db.query('UPDATE users SET banned = $1 WHERE id = $2', [banned, userId]);
        const action = banned ? 'baneado' : 'desbaneado';
        console.log(`🚫 Admin ${req.user.username} ${action} al usuario ${userId}`);
        res.json({ message: `Usuario ${action} correctamente.` });
    } catch (error) {
        console.error('Error PATCH /api/admin/users/:id/ban:', error.message);
        res.status(500).json({ error: 'Error al actualizar el estado del usuario.' });
    }
});

// ============ ADMIN: MODIFICAR MONEDAS DE UN USUARIO ============
app.patch('/api/admin/users/:id/coins', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(400).json({ error: 'ID de usuario inválido.' });
        }
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
            return res.status(400).json({ error: 'El campo amount debe ser un número entero.' });
        }
        await db.query('UPDATE users SET coins = GREATEST(0, coins + $1) WHERE id = $2', [amount, userId]);
        const result = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        const newCoins = result.rows[0]?.coins ?? 0;
        console.log(`🪙 Admin ${req.user.username} ${amount >= 0 ? 'añadió' : 'quitó'} ${Math.abs(amount)} monedas al usuario ${userId} (total: ${newCoins})`);
        res.json({ message: 'Monedas actualizadas.', coins: newCoins });
    } catch (error) {
        console.error('Error PATCH /api/admin/users/:id/coins:', error.message);
        res.status(500).json({ error: 'Error al modificar las monedas.' });
    }
});

// ============ ADMIN: ESTADÍSTICAS GLOBALES ============
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [usersResult, reviewsResult, favTeamResult, topGameResult] = await Promise.all([
            db.query('SELECT COUNT(*) AS total FROM users'),
            db.query('SELECT COUNT(*) AS total FROM reviews'),
            db.query(`
                SELECT team_abbr, team_name, COUNT(*) AS count
                FROM favorites_teams
                GROUP BY team_abbr, team_name
                ORDER BY count DESC
                LIMIT 1
            `),
            db.query(`
                SELECT game_type, COUNT(*) AS count
                FROM minigame_scores
                GROUP BY game_type
                ORDER BY count DESC
                LIMIT 1
            `)
        ]);
        res.json({
            totalUsers: parseInt(usersResult.rows[0].total, 10),
            totalReviews: parseInt(reviewsResult.rows[0].total, 10),
            mostFavoriteTeam: favTeamResult.rows[0] || null,
            mostPlayedGame: topGameResult.rows[0] || null
        });
    } catch (error) {
        console.error('Error GET /api/admin/stats:', error.message);
        res.status(500).json({ error: 'Error al obtener estadísticas globales.' });
    }
});

// ============ LEADERBOARD ============
app.get('/api/leaderboard', async (req, res) => {
    try {
        const cosmJoin = `
            LEFT JOIN user_cosmetics uc ON u.id = uc.user_id
            LEFT JOIN shop_items b ON uc.equipped_badge_id = b.id
            LEFT JOIN shop_items c ON uc.equipped_color_id = c.id
            LEFT JOIN shop_items f ON uc.equipped_frame_id = f.id
        `;
        const cosmSelect = `
            uc.active_title,
            b.icon_emoji AS badge_emoji,
            c.color_hex  AS username_color,
            f.name       AS frame_name
        `;

        const [coinsRes, reviewsRes, weekRes] = await Promise.allSettled([
            db.query(`
                SELECT u.id, u.username, u.avatar, u.coins, u.role,
                       ${cosmSelect}
                FROM users u ${cosmJoin}
                WHERE u.banned = false
                ORDER BY u.coins DESC LIMIT 10
            `),
            db.query(`
                SELECT u.id, u.username, u.avatar, u.role,
                       COUNT(r.id)::int AS review_count,
                       ${cosmSelect}
                FROM users u
                JOIN reviews r ON u.id = r.user_id
                ${cosmJoin}
                WHERE u.banned = false
                GROUP BY u.id, u.username, u.avatar, u.role,
                         uc.active_title, b.icon_emoji, c.color_hex, f.name
                ORDER BY review_count DESC LIMIT 10
            `),
            db.query(`
                SELECT u.id, u.username, u.avatar, u.role,
                       COUNT(ms.id)::int  AS games_played,
                       COALESCE(SUM(ms.score),0)::int AS total_score,
                       ${cosmSelect}
                FROM users u
                JOIN minigame_scores ms ON u.id = ms.user_id
                ${cosmJoin}
                WHERE ms.created_at >= NOW() - INTERVAL '7 days'
                  AND u.banned = false
                GROUP BY u.id, u.username, u.avatar, u.role,
                         uc.active_title, b.icon_emoji, c.color_hex, f.name
                ORDER BY total_score DESC, games_played DESC LIMIT 10
            `)
        ]);
        const topCoins   = coinsRes.status   === 'fulfilled' ? coinsRes.value   : { rows: [] };
        const topReviews = reviewsRes.status === 'fulfilled' ? reviewsRes.value : { rows: [] };
        const topWeek    = weekRes.status    === 'fulfilled' ? weekRes.value    : { rows: [] };
        if (weekRes.status === 'rejected') console.warn('Leaderboard topWeek falló:', weekRes.reason?.message);

        let topBettors = { rows: [] };
        try {
            topBettors = await db.query(`
                SELECT u.id, u.username, u.avatar, u.role,
                       COUNT(bt.id)::int AS total_bets,
                       COALESCE(SUM(CASE WHEN bt.status = 'won' THEN bt.payout - bt.amount ELSE 0 END),0)::int AS net_winnings,
                       COALESCE(SUM(CASE WHEN bt.status = 'won' THEN 1 ELSE 0 END),0)::int AS bets_won,
                       ${cosmSelect}
                FROM users u
                JOIN bets bt ON u.id = bt.user_id
                ${cosmJoin}
                WHERE u.banned = false AND bt.status != 'pending'
                GROUP BY u.id, u.username, u.avatar, u.role,
                         uc.active_title, b.icon_emoji, c.color_hex, f.name
                ORDER BY net_winnings DESC, bets_won DESC LIMIT 10
            `);
        } catch (_) {}

        const playerOfWeek = topWeek.rows[0] || topCoins.rows[0] || null;

        res.json({
            playerOfWeek,
            topCoins:    topCoins.rows,
            topReviews:  topReviews.rows,
            topWeek:     topWeek.rows,
            topBettors:  topBettors.rows
        });
    } catch (error) {
        console.error('Error GET /api/leaderboard:', error.message);
        res.status(500).json({ error: 'Error al obtener el leaderboard.' });
    }
});

// ============ TIENDA: OBTENER ITEMS ACTIVOS ============
app.get('/api/shop/items', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shop_items WHERE is_active = true ORDER BY type, price');
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Error GET /api/shop/items:', error.message);
        res.status(500).json({ error: 'Error al obtener items de la tienda.' });
    }
});

// ============ TIENDA: INVENTARIO DEL USUARIO ============
app.get('/api/shop/inventory', authenticateToken, async (req, res) => {
    try {
        const [invResult, cosResult] = await Promise.all([
            db.query(`
                SELECT si.*, ui.purchased_at
                FROM user_inventory ui
                JOIN shop_items si ON ui.item_id = si.id
                WHERE ui.user_id = $1
                ORDER BY ui.purchased_at DESC
            `, [req.user.id]),
            db.query('SELECT * FROM user_cosmetics WHERE user_id = $1', [req.user.id])
        ]);
        res.json({ inventory: invResult.rows, cosmetics: cosResult.rows[0] || null });
    } catch (error) {
        console.error('Error GET /api/shop/inventory:', error.message);
        res.status(500).json({ error: 'Error al obtener inventario.' });
    }
});

// ============ TIENDA: COMPRAR ITEM ============
app.post('/api/shop/buy', authenticateToken, async (req, res) => {
    try {
        const itemId = Number(req.body.item_id);
        if (!Number.isInteger(itemId) || itemId < 1) {
            return res.status(400).json({ error: 'ID de item inválido.' });
        }
        const itemResult = await db.query('SELECT * FROM shop_items WHERE id = $1 AND is_active = true', [itemId]);
        if (itemResult.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado.' });
        const item = itemResult.rows[0];

        const ownedResult = await db.query('SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2', [req.user.id, itemId]);
        if (ownedResult.rows.length > 0) return res.status(400).json({ error: 'Ya tienes este item.' });

        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [req.user.id]);
        const currentCoins = userResult.rows[0]?.coins ?? 0;
        if (currentCoins < item.price) {
            return res.status(400).json({ error: `No tienes suficientes monedas. Necesitas 🪙 ${item.price}.` });
        }

        if (item.type === 'title') {
            const pending = await db.query("SELECT id FROM title_requests WHERE user_id = $1 AND status = 'pending'", [req.user.id]);
            if (pending.rows.length > 0) return res.status(400).json({ error: 'Ya tienes una solicitud de título pendiente.' });
        }

        await db.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [item.price, req.user.id]);
        await db.query('INSERT INTO user_inventory (user_id, item_id) VALUES ($1, $2)', [req.user.id, itemId]);

        const newCoinsResult = await db.query('SELECT coins FROM users WHERE id = $1', [req.user.id]);
        const newCoins = newCoinsResult.rows[0]?.coins ?? 0;
        console.log(`🛒 ${req.user.username} compró "${item.name}" por ${item.price} monedas`);
        res.json({ message: `¡Compraste "${item.name}"!`, coins: newCoins, item });
    } catch (error) {
        console.error('Error POST /api/shop/buy:', error.message);
        res.status(500).json({ error: 'Error al procesar la compra.' });
    }
});

// ============ TIENDA: EQUIPAR ITEM ============
app.post('/api/shop/equip', authenticateToken, async (req, res) => {
    try {
        const itemId = Number(req.body.item_id);
        if (!Number.isInteger(itemId) || itemId < 1) return res.status(400).json({ error: 'ID inválido.' });

        const ownedResult = await db.query(`
            SELECT si.type FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = $1 AND ui.item_id = $2
        `, [req.user.id, itemId]);
        if (ownedResult.rows.length === 0) return res.status(403).json({ error: 'No tienes este item.' });

        const typeToColumn = { badge: 'equipped_badge_id', color: 'equipped_color_id', frame: 'equipped_frame_id' };
        const column = typeToColumn[ownedResult.rows[0].type];
        if (!column) return res.status(400).json({ error: 'Este item no se puede equipar directamente.' });

        await db.query(`
            INSERT INTO user_cosmetics (user_id, ${column}, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ${column} = $2, updated_at = NOW()
        `, [req.user.id, itemId]);
        res.json({ message: 'Item equipado.' });
    } catch (error) {
        console.error('Error POST /api/shop/equip:', error.message);
        res.status(500).json({ error: 'Error al equipar item.' });
    }
});

// ============ TIENDA: DESEQUIPAR ITEM ============
app.post('/api/shop/unequip', authenticateToken, async (req, res) => {
    try {
        const typeToColumn = { badge: 'equipped_badge_id', color: 'equipped_color_id', frame: 'equipped_frame_id' };
        const column = typeToColumn[req.body.type];
        if (!column) return res.status(400).json({ error: 'Tipo inválido.' });
        await db.query(`
            INSERT INTO user_cosmetics (user_id, ${column}, updated_at)
            VALUES ($1, NULL, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ${column} = NULL, updated_at = NOW()
        `, [req.user.id]);
        res.json({ message: 'Item desequipado.' });
    } catch (error) {
        console.error('Error POST /api/shop/unequip:', error.message);
        res.status(500).json({ error: 'Error al desequipar.' });
    }
});

// ============ SOLICITAR TÍTULO PERSONALIZADO ============
app.post('/api/title-request', authenticateToken, async (req, res) => {
    try {
        const titleText = String(req.body.title_text || '').trim();
        if (titleText.length < 3 || titleText.length > 50) {
            return res.status(400).json({ error: 'El título debe tener entre 3 y 50 caracteres.' });
        }
        const titleItem = await db.query(
            "SELECT si.id FROM shop_items si JOIN user_inventory ui ON si.id = ui.item_id WHERE si.type = 'title' AND ui.user_id = $1",
            [req.user.id]
        );
        if (titleItem.rows.length === 0) return res.status(403).json({ error: 'No tienes el slot de título. Cómpralo primero.' });

        const pending = await db.query("SELECT id FROM title_requests WHERE user_id = $1 AND status = 'pending'", [req.user.id]);
        if (pending.rows.length > 0) return res.status(400).json({ error: 'Ya tienes una solicitud pendiente. Espera a que el admin la revise.' });

        const result = await db.query(
            'INSERT INTO title_requests (user_id, title_text) VALUES ($1, $2) RETURNING *',
            [req.user.id, titleText]
        );
        console.log(`✏️ ${req.user.username} solicitó título: "${titleText}"`);
        res.status(201).json({ request: result.rows[0], message: 'Solicitud enviada. El admin la revisará pronto.' });
    } catch (error) {
        console.error('Error POST /api/title-request:', error.message);
        res.status(500).json({ error: 'Error al enviar la solicitud.' });
    }
});

// ============ ESTADO DE LA SOLICITUD DE TÍTULO ============
app.get('/api/title-request/status', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM title_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        );
        res.json({ request: result.rows[0] || null });
    } catch (error) {
        console.error('Error GET /api/title-request/status:', error.message);
        res.status(500).json({ error: 'Error al obtener estado del título.' });
    }
});

// ============ COSMÉTICOS PÚBLICOS DE UN USUARIO ============
app.get('/api/users/:id/cosmetics', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'ID inválido.' });
        const result = await db.query(`
            SELECT uc.active_title,
                   b.icon_emoji AS badge_emoji, b.name AS badge_name,
                   c.color_hex  AS username_color, c.name AS color_name,
                   f.icon_emoji AS frame_emoji,   f.name AS frame_name
            FROM user_cosmetics uc
            LEFT JOIN shop_items b ON uc.equipped_badge_id = b.id
            LEFT JOIN shop_items c ON uc.equipped_color_id = c.id
            LEFT JOIN shop_items f ON uc.equipped_frame_id = f.id
            WHERE uc.user_id = $1
        `, [userId]);
        res.json({ cosmetics: result.rows[0] || null });
    } catch (error) {
        console.error('Error GET /api/users/:id/cosmetics:', error.message);
        res.status(500).json({ error: 'Error al obtener cosméticos.' });
    }
});

// ============ ADMIN: ITEMS DE LA TIENDA ============
app.get('/api/admin/shop/items', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shop_items ORDER BY type, price');
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Error GET /api/admin/shop/items:', error.message);
        res.status(500).json({ error: 'Error al obtener items.' });
    }
});

app.post('/api/admin/shop/items', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, type, price, icon_emoji, color_hex } = req.body;
        if (!name || !['badge', 'color', 'frame', 'title'].includes(type) || !Number.isFinite(Number(price))) {
            return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios.' });
        }
        const result = await db.query(
            'INSERT INTO shop_items (name, description, type, price, icon_emoji, color_hex) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [name.slice(0,50), (description||'').slice(0,200), type, Math.max(0,Math.floor(Number(price))), (icon_emoji||'').slice(0,10), color_hex||null]
        );
        console.log(`🛍️ Admin ${req.user.username} creó item: "${name}"`);
        res.status(201).json({ item: result.rows[0] });
    } catch (error) {
        console.error('Error POST /api/admin/shop/items:', error.message);
        res.status(500).json({ error: 'Error al crear item.' });
    }
});

app.patch('/api/admin/shop/items/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        if (!Number.isInteger(itemId) || itemId < 1) return res.status(400).json({ error: 'ID inválido.' });
        const { name, description, price, icon_emoji, color_hex, is_active } = req.body;
        await db.query(`
            UPDATE shop_items SET
                name        = COALESCE($1, name),
                description = COALESCE($2, description),
                price       = COALESCE($3, price),
                icon_emoji  = COALESCE($4, icon_emoji),
                color_hex   = COALESCE($5, color_hex),
                is_active   = COALESCE($6, is_active)
            WHERE id = $7
        `, [
            name ? name.slice(0,50) : null,
            description !== undefined ? description.slice(0,200) : null,
            price !== undefined && price !== '' ? Math.max(0,Math.floor(Number(price))) : null,
            icon_emoji ? icon_emoji.slice(0,10) : null,
            color_hex !== undefined ? (color_hex || null) : null,
            typeof is_active === 'boolean' ? is_active : null,
            itemId
        ]);
        const updated = await db.query('SELECT * FROM shop_items WHERE id = $1', [itemId]);
        res.json({ item: updated.rows[0] });
    } catch (error) {
        console.error('Error PATCH /api/admin/shop/items/:id:', error.message);
        res.status(500).json({ error: 'Error al actualizar item.' });
    }
});

app.delete('/api/admin/shop/items/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        if (!Number.isInteger(itemId) || itemId < 1) return res.status(400).json({ error: 'ID inválido.' });
        await db.query('DELETE FROM shop_items WHERE id = $1', [itemId]);
        console.log(`🗑️ Admin ${req.user.username} eliminó item ${itemId}`);
        res.json({ message: 'Item eliminado.' });
    } catch (error) {
        console.error('Error DELETE /api/admin/shop/items/:id:', error.message);
        res.status(500).json({ error: 'Error al eliminar item.' });
    }
});

// ============ ADMIN: SOLICITUDES DE TÍTULOS ============
app.get('/api/admin/title-requests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT tr.*, u.username
            FROM title_requests tr
            JOIN users u ON tr.user_id = u.id
            ORDER BY
                CASE tr.status WHEN 'pending' THEN 0 ELSE 1 END,
                tr.created_at DESC
        `);
        res.json({ requests: result.rows });
    } catch (error) {
        console.error('Error GET /api/admin/title-requests:', error.message);
        res.status(500).json({ error: 'Error al obtener solicitudes.' });
    }
});

app.patch('/api/admin/title-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!Number.isInteger(requestId) || requestId < 1) return res.status(400).json({ error: 'ID inválido.' });
        const { status, admin_note } = req.body;
        if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Estado inválido.' });

        const reqResult = await db.query('SELECT * FROM title_requests WHERE id = $1', [requestId]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
        const titleRequest = reqResult.rows[0];

        await db.query(
            'UPDATE title_requests SET status = $1, admin_note = $2, reviewed_at = NOW() WHERE id = $3',
            [status, admin_note || null, requestId]
        );

        if (status === 'approved') {
            await db.query(`
                INSERT INTO user_cosmetics (user_id, active_title, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET active_title = $2, updated_at = NOW()
            `, [titleRequest.user_id, titleRequest.title_text]);
        }

        const action = status === 'approved' ? 'aprobó' : 'rechazó';
        console.log(`✏️ Admin ${req.user.username} ${action} el título "${titleRequest.title_text}"`);
        res.json({ message: `Solicitud ${action}.` });
    } catch (error) {
        console.error('Error PATCH /api/admin/title-requests/:id:', error.message);
        res.status(500).json({ error: 'Error al procesar la solicitud.' });
    }
});

// ============ APUESTAS: EVENTOS PÚBLICOS ============
app.get('/api/bets/events', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT be.*,
                   COUNT(b.id)::int                                                      AS total_bets,
                   COALESCE(SUM(b.amount), 0)::int                                       AS total_pool,
                   COUNT(CASE WHEN b.team_choice = 'team_a' THEN 1 END)::int             AS bets_team_a,
                   COUNT(CASE WHEN b.team_choice = 'team_b' THEN 1 END)::int             AS bets_team_b,
                   COALESCE(SUM(CASE WHEN b.team_choice = 'team_a' THEN b.amount END),0)::int AS pool_team_a,
                   COALESCE(SUM(CASE WHEN b.team_choice = 'team_b' THEN b.amount END),0)::int AS pool_team_b
            FROM bet_events be
            LEFT JOIN bets b ON be.id = b.event_id
            GROUP BY be.id
            ORDER BY
                CASE be.status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END,
                be.created_at DESC
            LIMIT 50
        `);
        res.json({ events: result.rows });
    } catch (error) {
        console.error('Error GET /api/bets/events:', error.message);
        res.status(500).json({ error: 'Error al obtener eventos de apuestas.' });
    }
});

// ============ APUESTAS: COLOCAR APUESTA ============
app.post('/api/bets/place', authenticateToken, async (req, res) => {
    try {
        const eventId = Number(req.body.event_id);
        const choice  = String(req.body.team_choice || '');
        const amount  = Number(req.body.amount);

        if (!Number.isInteger(eventId) || eventId < 1)
            return res.status(400).json({ error: 'Evento inválido.' });
        if (!['team_a', 'team_b'].includes(choice))
            return res.status(400).json({ error: 'Elección inválida.' });
        if (!Number.isInteger(amount) || amount < 10)
            return res.status(400).json({ error: 'La apuesta mínima es 🪙 10 monedas.' });

        const evResult = await db.query('SELECT * FROM bet_events WHERE id = $1', [eventId]);
        if (evResult.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado.' });
        if (evResult.rows[0].status !== 'open') return res.status(400).json({ error: 'Este evento ya no admite apuestas.' });

        const existing = await db.query('SELECT id FROM bets WHERE event_id = $1 AND user_id = $2', [eventId, req.user.id]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Ya has apostado en este evento.' });

        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [req.user.id]);
        const coins = userResult.rows[0]?.coins ?? 0;
        if (coins < amount) return res.status(400).json({ error: `No tienes suficientes monedas. Tienes 🪙 ${coins}.` });

        await db.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [amount, req.user.id]);
        await db.query(
            'INSERT INTO bets (event_id, user_id, team_choice, amount) VALUES ($1, $2, $3, $4)',
            [eventId, req.user.id, choice, amount]
        );
        const newCoins = (await db.query('SELECT coins FROM users WHERE id = $1', [req.user.id])).rows[0].coins;
        console.log(`🎰 ${req.user.username} apostó 🪙 ${amount} a "${choice}" en "${evResult.rows[0].title}"`);
        res.status(201).json({ coins: newCoins, message: `¡Apuesta de 🪙 ${amount} registrada!` });
    } catch (error) {
        console.error('Error POST /api/bets/place:', error.message);
        res.status(500).json({ error: 'Error al registrar la apuesta.' });
    }
});

// ============ APUESTAS: MIS APUESTAS ============
app.get('/api/bets/my-bets', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT b.*, be.title, be.team_a, be.team_b, be.status AS event_status, be.winner
            FROM bets b
            JOIN bet_events be ON b.event_id = be.id
            WHERE b.user_id = $1
            ORDER BY b.created_at DESC
            LIMIT 50
        `, [req.user.id]);
        res.json({ bets: result.rows });
    } catch (error) {
        console.error('Error GET /api/bets/my-bets:', error.message);
        res.status(500).json({ error: 'Error al obtener tus apuestas.' });
    }
});

// ============ ADMIN: LISTAR EVENTOS DE APUESTAS ============
app.get('/api/admin/bet-events', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT be.*,
                   COUNT(b.id)::int AS total_bets,
                   COALESCE(SUM(b.amount), 0)::int AS total_pool,
                   u.username AS created_by_name
            FROM bet_events be
            LEFT JOIN bets b ON be.id = b.event_id
            LEFT JOIN users u ON be.created_by = u.id
            GROUP BY be.id, u.username
            ORDER BY be.created_at DESC
        `);
        res.json({ events: result.rows });
    } catch (error) {
        console.error('Error GET /api/admin/bet-events:', error.message);
        res.status(500).json({ error: 'Error al obtener eventos.' });
    }
});

// ============ ADMIN: CREAR EVENTO ============
app.post('/api/admin/bet-events', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, team_a, team_b, closes_at } = req.body;
        if (!title?.trim() || !team_a?.trim() || !team_b?.trim())
            return res.status(400).json({ error: 'Título, equipo A y equipo B son obligatorios.' });
        const result = await db.query(
            'INSERT INTO bet_events (title, description, team_a, team_b, closes_at, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [title.trim(), description?.trim() || null, team_a.trim(), team_b.trim(), closes_at || null, req.user.id]
        );
        console.log(`🎰 Admin ${req.user.username} creó evento: "${title}"`);
        res.status(201).json({ event: result.rows[0] });
    } catch (error) {
        console.error('Error POST /api/admin/bet-events:', error.message);
        res.status(500).json({ error: 'Error al crear el evento.' });
    }
});

// ============ ADMIN: CERRAR APUESTAS ============
app.patch('/api/admin/bet-events/:id/close', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query("UPDATE bet_events SET status = 'closed' WHERE id = $1 AND status = 'open'", [id]);
        res.json({ message: 'Apuestas cerradas. Ya no se aceptan nuevas.' });
    } catch (error) {
        console.error('Error PATCH close bet-event:', error.message);
        res.status(500).json({ error: 'Error al cerrar el evento.' });
    }
});

// ============ ADMIN: RESOLVER EVENTO Y REPARTIR PREMIOS ============
app.patch('/api/admin/bet-events/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id     = Number(req.params.id);
        const winner = String(req.body.winner || '');
        if (!['team_a', 'team_b', 'draw', 'cancelled'].includes(winner))
            return res.status(400).json({ error: 'Ganador inválido.' });

        const evResult = await db.query('SELECT * FROM bet_events WHERE id = $1', [id]);
        if (evResult.rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado.' });
        if (evResult.rows[0].status === 'resolved') return res.status(400).json({ error: 'Ya está resuelto.' });
        const ev = evResult.rows[0];

        const betsResult = await db.query('SELECT * FROM bets WHERE event_id = $1', [id]);
        const bets = betsResult.rows;

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const bet of bets) {
                let newStatus = 'lost';
                let payout    = 0;
                if (winner === 'cancelled' || winner === 'draw') {
                    newStatus = 'refunded';
                    payout    = bet.amount;
                } else if (bet.team_choice === winner) {
                    newStatus = 'won';
                    payout    = bet.amount * 2;
                }
                await client.query('UPDATE bets SET status = $1, payout = $2 WHERE id = $3', [newStatus, payout, bet.id]);
                if (payout > 0) await client.query('UPDATE users SET coins = coins + $1 WHERE id = $2', [payout, bet.user_id]);
            }
            const finalStatus = winner === 'cancelled' ? 'cancelled' : 'resolved';
            const finalWinner = winner === 'cancelled' ? null : winner;
            await client.query(
                'UPDATE bet_events SET status = $1, winner = $2, resolved_at = NOW() WHERE id = $3',
                [finalStatus, finalWinner, id]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        const winnersCount = bets.filter(b => b.team_choice === winner).length;
        console.log(`🎰 Admin ${req.user.username} resolvió "${ev.title}" → ${winner} (${winnersCount} ganadores)`);
        res.json({ message: `Resuelto. Ganador: ${winner}. ${winnersCount} premios entregados.` });
    } catch (error) {
        console.error('Error PATCH resolve bet-event:', error.message);
        res.status(500).json({ error: 'Error al resolver el evento.' });
    }
});

// ============ ADMIN: ELIMINAR EVENTO (solo sin apuestas) ============
app.delete('/api/admin/bet-events/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const countResult = await db.query('SELECT COUNT(*)::int AS c FROM bets WHERE event_id = $1', [id]);
        if (countResult.rows[0].c > 0)
            return res.status(400).json({ error: 'No puedes eliminar un evento con apuestas. Cancélalo primero.' });
        await db.query('DELETE FROM bet_events WHERE id = $1', [id]);
        res.json({ message: 'Evento eliminado.' });
    } catch (error) {
        console.error('Error DELETE bet-event:', error.message);
        res.status(500).json({ error: 'Error al eliminar.' });
    }
});

app.listen(PORT, () => {
    console.log(`🏀 Servidor NBA corriendo en http://localhost:${PORT}`);
    console.log(`📡 API Key BallDontLie: ${API_KEY ? 'Sí' : 'No'}`);
    console.log(`� JWT Secret: ${JWT_SECRET ? 'Configurado' : 'No configurado'}`);
    console.log(`�📺 ESPN API: Activa (sin key)`);
    console.log(`🏆 NBA CDN: Activa (stats en vivo + standings)`);
    console.log(`⏱️  Caché: ${CACHE_DURATION/1000}s | Rate limit: 20 peticiones/min`);
});
