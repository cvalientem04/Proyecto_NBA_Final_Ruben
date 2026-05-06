-- ============================================================
-- MIGRACIÓN: Verificación de email
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- ============================================================

-- Añadir columna a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Los usuarios ya registrados se marcan como verificados para no bloquearlos
UPDATE users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false;

-- Tabla de tokens de verificación
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens(token);
