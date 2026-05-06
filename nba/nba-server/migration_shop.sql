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
('Rookie',          'Muestra que eres nuevo en la comunidad NBA LIVE',              'badge', 500,  '🏀'),
('Veterano',        'Has estado en la comunidad desde el principio',                 'badge', 1000, '💪'),
('All-Star',        'Eres de los buenos, como los All-Stars de la NBA',              'badge', 1500, '⭐'),
('Experto en Draft','Nadie sabe más de draft que tú',                                'badge', 2000, '📋'),
('MVP',             'El más valioso de toda la comunidad NBA LIVE',                  'badge', 3000, '🏆'),
('Campeón',         'La insignia más exclusiva. Solo para los mejores',             'badge', 5000, '💍'),
('Fan Acérrimo',    'No te pierdes ni un solo partido de la temporada',             'badge', 800,  '🔥')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Colores de nombre =====
INSERT INTO shop_items (name, description, type, price, icon_emoji, color_hex) VALUES
('Dorado',          'Tu nombre brillará en dorado. El color del oro olímpico',     'color', 2000, '🥇', '#FFD700'),
('Rojo NBA',        'El rojo intenso de la competición NBA',                        'color', 1000, '🔴', '#E53935'),
('Verde Celtics',   'El verde legendario del parquet de Boston',                    'color', 1000, '💚', '#007A33'),
('Azul Real',       'El azul de los grandes equipos históricos',                    'color', 1000, '💙', '#1565C0'),
('Púrpura Lakers',  'El púrpura de Hollywood, de Kobe y LeBron',                   'color', 1000, '💜', '#552583'),
('Naranja Fuego',   'Ardiente como un slam dunk en el último segundo',              'color', 1000, '🟠', '#FF6B35')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Marcos de avatar =====
INSERT INTO shop_items (name, description, type, price, icon_emoji) VALUES
('Marco Básico',   'Un marco sencillo pero elegante para tu avatar',               'frame', 500,  '🔵'),
('Marco All-Star', 'Marco dorado del All-Star Weekend',                             'frame', 2000, '🌟'),
('Marco MVP',      'El marco del trofeo MVP. Para los mejores jugadores',           'frame', 3000, '🏆'),
('Marco Campeón',  'El marco del anillo de campeón. El más exclusivo de la tienda', 'frame', 5000, '💍')
ON CONFLICT (name, type) DO NOTHING;

-- ===== DATOS POR DEFECTO: Slot de título personalizado =====
INSERT INTO shop_items (name, description, type, price, icon_emoji) VALUES
('Título Personalizado',
 'Crea tu propio título único. El admin lo revisará antes de publicarlo. Puedes cambiarlo cuando quieras.',
 'title', 5000, '✏️')
ON CONFLICT (name, type) DO NOTHING;
