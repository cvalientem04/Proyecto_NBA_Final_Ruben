const Database = require('better-sqlite3');
const path = require('path');

// Crear/conectar base de datos
const db = new Database(path.join(__dirname, 'users.db'));

// Activar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');

// Crear tabla de usuarios si no existe
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        plan TEXT DEFAULT 'free',
        coins INTEGER DEFAULT 1000,
        avatar TEXT DEFAULT '🏀',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('✅ Base de datos inicializada correctamente');

module.exports = db;
