const { Pool } = require('pg');
require('dotenv').config();

// Crear el pool de conexiones a Supabase
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necesario para algunas conexiones a Supabase si no tienes el certificado local
    }
});

// Probar la conexión
db.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar con Supabase:', err.stack);
    } else {
        console.log('✅ Conectado a la base de datos Supabase correctamente');
        release();
    }
});

module.exports = db;
