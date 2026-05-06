-- ============================================================
-- NBA LIVE HUB - Base de datos completa
-- Ejecutar en PostgreSQL local o en Supabase > SQL Editor
-- Copia y pega TODO este archivo de una sola vez.
-- ============================================================

-- ============ TABLA: USUARIOS ============
-- Almacena cuentas de usuario con autenticación JWT y roles.
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(30)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,           -- bcrypt hash
    plan         VARCHAR(20)  NOT NULL DEFAULT 'free',
    coins        INTEGER      NOT NULL DEFAULT 1000,
    avatar       VARCHAR(10)  NOT NULL DEFAULT '🏀',
    role         VARCHAR(20)  NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    banned       BOOLEAN      NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============ TABLA: RESEÑAS ============
-- Valoraciones públicas de la plataforma (1-5 estrellas).
CREATE TABLE IF NOT EXISTS reviews (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name         VARCHAR(30)  NOT NULL,
    rating       SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      VARCHAR(280) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============ TABLA: EQUIPOS FAVORITOS ============
-- Un usuario puede guardar equipos NBA como favoritos.
CREATE TABLE IF NOT EXISTS favorites_teams (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_abbr    VARCHAR(5)   NOT NULL,            -- p.ej. 'LAL', 'BOS'
    team_name    VARCHAR(60)  NOT NULL,
    added_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, team_abbr)
);

-- ============ TABLA: JUGADORES FAVORITOS ============
-- Un usuario puede guardar jugadores NBA como favoritos.
CREATE TABLE IF NOT EXISTS favorites_players (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id    VARCHAR(100) NOT NULL,            -- id o clave del jugador
    player_name  VARCHAR(100) NOT NULL,
    team_abbr    VARCHAR(5),
    added_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, player_id)
);

-- ============ TABLA: PUNTUACIONES MINIJUEGOS ============
-- Historial de puntuaciones de trivia, guess, etc.
CREATE TABLE IF NOT EXISTS minigame_scores (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type    VARCHAR(30)  NOT NULL,            -- p.ej. 'trivia', 'guess'
    score        INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============ ÍNDICES (mejoran el rendimiento) ============
CREATE INDEX IF NOT EXISTS idx_reviews_created        ON reviews        (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fav_teams_user         ON favorites_teams (user_id);
CREATE INDEX IF NOT EXISTS idx_fav_players_user       ON favorites_players (user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_scores_user   ON minigame_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_scores_type   ON minigame_scores (game_type);

-- ============================================================
-- OPCIONAL: crear el primer usuario administrador
-- Sustituye el email por el real antes de ejecutar.
-- La contraseña la establece el propio usuario al registrarse;
-- luego promuévele a admin con esta línea:
-- ============================================================
-- UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';

-- ============================================================
-- VERIFICACIÓN: ejecuta esto para comprobar que las tablas
-- se crearon correctamente.
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
