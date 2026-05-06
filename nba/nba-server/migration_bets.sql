-- ============================================================
-- migration_bets.sql
-- Sistema de apuestas para NBA LIVE
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Eventos de apuestas (creados por el admin)
CREATE TABLE IF NOT EXISTS bet_events (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(120) NOT NULL,
    description TEXT,
    team_a      VARCHAR(60)  NOT NULL,
    team_b      VARCHAR(60)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'resolved', 'cancelled')),
    winner      VARCHAR(10)  DEFAULT NULL
                CHECK (winner IS NULL OR winner IN ('team_a', 'team_b', 'draw')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    closes_at   TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Apuestas individuales de cada usuario
CREATE TABLE IF NOT EXISTS bets (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES bet_events(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    team_choice VARCHAR(10) NOT NULL CHECK (team_choice IN ('team_a', 'team_b')),
    amount      INTEGER NOT NULL CHECK (amount >= 10),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
    payout      INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)   -- un usuario solo puede apostar una vez por evento
);

CREATE INDEX IF NOT EXISTS idx_bets_user_id        ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_event_id       ON bets(event_id);
CREATE INDEX IF NOT EXISTS idx_bet_events_status   ON bet_events(status);
