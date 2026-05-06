-- ============================================================
-- NBA LIVE HUB -- Script COMPLETO de base de datos
-- Autor: Carlos Valiente
-- ============================================================
-- INSTRUCCIONES PARA EL PROFESOR:
--
--   Opcion A: PostgreSQL local (pgAdmin / psql)
--     1. Abre pgAdmin y crea una base de datos llamada "nba_live"
--     2. Haz clic derecho en la base de datos > Query Tool
--     3. Copia y pega TODO este archivo y ejecutalo (F5)
--
--   Opcion B: Supabase (en la nube)
--     1. Accede a supabase.com y abre tu proyecto
--     2. Ve a SQL Editor > + New query
--     3. Copia y pega TODO este archivo y ejecutalo
--
-- VARIABLES DE ENTORNO (.env) necesarias para arrancar el servidor:
--
--   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nba_live
--   JWT_SECRET=cualquier_cadena_secreta_larga_aqui_min32chars
--   NBA_API_KEY=tu_api_key_de_balldontlie_si_la_tienes
--
--   (Para Supabase usa la "Connection string" que aparece en
--    Project Settings > Database > Connection string > URI)
-- ============================================================

-- ============================================================
-- LIMPIEZA PREVIA (descomenta si quieres empezar desde cero)
-- AVISO: esto borra todos los datos existentes
-- ============================================================
-- DROP TABLE IF EXISTS minigame_scores   CASCADE;
-- DROP TABLE IF EXISTS favorites_players CASCADE;
-- DROP TABLE IF EXISTS favorites_teams   CASCADE;
-- DROP TABLE IF EXISTS reviews           CASCADE;
-- DROP TABLE IF EXISTS users             CASCADE;

-- ============================================================
-- TABLA: USUARIOS
-- Almacena cuentas, hashes bcrypt, monedas, avatar y roles.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL       PRIMARY KEY,
    username    VARCHAR(30)  NOT NULL UNIQUE,
    email       VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,                  -- hash bcrypt
    plan        VARCHAR(20)  NOT NULL DEFAULT 'free',
    coins       INTEGER      NOT NULL DEFAULT 1000,
    avatar      VARCHAR(10)  NOT NULL DEFAULT '🏀',
    role        VARCHAR(20)  NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    banned      BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: RESEÑAS
-- Valoraciones publicas de la plataforma (1-5 estrellas).
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id          SERIAL      PRIMARY KEY,
    user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    name        VARCHAR(30)  NOT NULL,
    rating      SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     VARCHAR(280) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: EQUIPOS FAVORITOS
-- Un usuario puede guardar equipos NBA como favoritos.
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites_teams (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_abbr   VARCHAR(5)   NOT NULL,   -- p.ej. 'LAL', 'BOS'
    team_name   VARCHAR(60)  NOT NULL,
    added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, team_abbr)
);

-- ============================================================
-- TABLA: JUGADORES FAVORITOS
-- Un usuario puede guardar jugadores NBA como favoritos.
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites_players (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id   VARCHAR(100) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    team_abbr   VARCHAR(5),
    added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, player_id)
);

-- ============================================================
-- TABLA: PUNTUACIONES MINIJUEGOS
-- Historial de puntuaciones de trivia, guess, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS minigame_scores (
    id          SERIAL      PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type   VARCHAR(30) NOT NULL,   -- p.ej. 'trivia', 'guess'
    score       INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDICES (mejoran la velocidad de consultas frecuentes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reviews_created      ON reviews          (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fav_teams_user       ON favorites_teams  (user_id);
CREATE INDEX IF NOT EXISTS idx_fav_players_user     ON favorites_players(user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_scores_user ON minigame_scores  (user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_scores_type ON minigame_scores  (game_type);

-- ============================================================
-- PRIMER USUARIO ADMINISTRADOR (ejecuta DESPUES de registrarte)
-- Sustituye el email por el que usaste al registrarte en la web.
-- ============================================================
-- UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';

-- ============================================================
-- VERIFICACION: comprueba que las 5 tablas se crearon bien
-- ============================================================
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
ORDER  BY table_name;
