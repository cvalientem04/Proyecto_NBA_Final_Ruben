-- ============================================================
-- MIGRACIÓN: Sistema de Roles (Admin / Usuario)
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Añadir columna de rol a la tabla users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 2. Añadir columna de ban a la tabla users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

-- 3. (OPCIONAL) Verificar que se añadieron correctamente
-- SELECT id, username, email, role, banned FROM users LIMIT 5;

-- 4. Convertir un usuario en admin (reemplaza el email por el tuyo)
-- UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';
