-- ============================================================
-- MIGRACIÓN: Sistema de Tienda Virtual, Insignias y Títulos
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- ============================================================

-- Tabla de items de la tienda
CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200) DEFAULT '',
    type VARCHAR(20) NOT NULL CHECK (type IN ('badge', 'color', 'frame', 'title')),
    price INTEGER NOT NULL DEFAULT 0,
    icon_emoji VARCHAR(10) DEFAULT '',
    color_hex VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, type)
);

-- Inventario del usuario (items comprados)
CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Cosméticos equipados por usuario
CREATE TABLE IF NOT EXISTS user_cosmetics (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    equipped_badge_id INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
    equipped_color_id INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
    equipped_frame_id INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
    active_title VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitudes de títulos personalizados
CREATE TABLE IF NOT EXISTS title_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_text VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_title_requests_user ON title_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_title_requests_status ON title_requests(status);

-- ===== DATOS POR DEFECTO: Insignias =====
INSERT INTO shop_items (name, description, type, price, icon_emoji) VALUES
('Rookie',          'Muestra que eres nuevo en la comunidad NBA LIVE',              'badge',  800, '🏀'),
('Fan Acérrimo',    'No te pierdes ni un solo partido de la temporada',             'badge', 1500, '🔥'),
('Veterano',        'Has estado en la comunidad desde el principio',                 'badge', 2000, '💪'),
('All-Star',        'Eres de los buenos, como los All-Stars de la NBA',              'badge', 3000, '⭐'),
('Experto en Draft','Nadie sabe más de draft que tú',                                'badge', 3500, '📋'),
('MVP',             'El más valioso de toda la comunidad NBA LIVE',                  'badge', 5000, '🏆'),
('Campeón',         'La insignia más exclusiva. Solo para los mejores',             'badge', 8000, '💍')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Colores de nombre =====
INSERT INTO shop_items (name, description, type, price, icon_emoji, color_hex) VALUES
('Rojo NBA',        'El rojo intenso de la competición NBA',                        'color', 2000, '🔴', '#E53935'),
('Verde Celtics',   'El verde legendario del parquet de Boston',                    'color', 2000, '💚', '#007A33'),
('Azul Real',       'El azul de los grandes equipos históricos',                    'color', 2000, '💙', '#1565C0'),
('Púrpura Lakers',  'El púrpura de Hollywood, de Kobe y LeBron',                   'color', 2000, '💜', '#552583'),
('Naranja Fuego',   'Ardiente como un slam dunk en el último segundo',              'color', 2000, '🟠', '#FF6B35'),
('Dorado',          'Tu nombre brillará en dorado. El color del oro olímpico',     'color', 4000, '🥇', '#FFD700')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Marcos de avatar =====
INSERT INTO shop_items (name, description, type, price, icon_emoji) VALUES
('Marco Básico',   'Un marco sencillo pero elegante para tu avatar',               'frame', 1000, '🔵'),
('Marco All-Star', 'Marco dorado del All-Star Weekend',                             'frame', 3500, '🌟'),
('Marco MVP',      'El marco del trofeo MVP. Para los mejores jugadores',           'frame', 5000, '🏆'),
('Marco Campeón',  'El marco del anillo de campeón. El más exclusivo de la tienda', 'frame', 8000, '💍')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Slot de título personalizado =====
INSERT INTO shop_items (name, description, type, price, icon_emoji) VALUES
('Título Personalizado',
 'Crea tu propio título único. El admin lo revisará antes de publicarlo. Puedes cambiarlo cuando quieras.',
 'title', 7500, '✏️')
ON CONFLICT (name, type) DO NOTHING;

-- ===== ACTUALIZAR PRECIOS EN BD EXISTENTE =====
-- Ejecutar si los items ya existen en Supabase
UPDATE shop_items SET price =  800 WHERE name = 'Rookie'           AND type = 'badge';
UPDATE shop_items SET price = 1500 WHERE name = 'Fan Acérrimo'     AND type = 'badge';
UPDATE shop_items SET price = 2000 WHERE name = 'Veterano'         AND type = 'badge';
UPDATE shop_items SET price = 3000 WHERE name = 'All-Star'         AND type = 'badge';
UPDATE shop_items SET price = 3500 WHERE name = 'Experto en Draft' AND type = 'badge';
UPDATE shop_items SET price = 5000 WHERE name = 'MVP'              AND type = 'badge';
UPDATE shop_items SET price = 8000 WHERE name = 'Campeón'          AND type = 'badge';

UPDATE shop_items SET price = 2000 WHERE name = 'Rojo NBA'         AND type = 'color';
UPDATE shop_items SET price = 2000 WHERE name = 'Verde Celtics'    AND type = 'color';
UPDATE shop_items SET price = 2000 WHERE name = 'Azul Real'        AND type = 'color';
UPDATE shop_items SET price = 2000 WHERE name = 'Púrpura Lakers'   AND type = 'color';
UPDATE shop_items SET price = 2000 WHERE name = 'Naranja Fuego'    AND type = 'color';
UPDATE shop_items SET price = 4000 WHERE name = 'Dorado'           AND type = 'color';

UPDATE shop_items SET price = 1000 WHERE name = 'Marco Básico'     AND type = 'frame';
UPDATE shop_items SET price = 3500 WHERE name = 'Marco All-Star'   AND type = 'frame';
UPDATE shop_items SET price = 5000 WHERE name = 'Marco MVP'        AND type = 'frame';
UPDATE shop_items SET price = 8000 WHERE name = 'Marco Campeón'    AND type = 'frame';

UPDATE shop_items SET price = 7500 WHERE name = 'Título Personalizado' AND type = 'title';
