// ============================================================
// config.js - Configuración global de la aplicación
// Contiene las constantes y mapeos que se usan en toda la app.
// ============================================================

// URL base del servidor backend (cambiar en producción al dominio real)
const API_SERVER = 'https://proyecto-nba-final-ruben.onrender.com';

// Mapa de conversión de abreviaturas de equipos ESPN → NBA CDN.
// Algunas abreviaturas difieren entre la API de ESPN y la CDN oficial de la NBA,
// por ejemplo ESPN usa 'GS' para Golden State, pero la NBA CDN usa 'GSW'.
const espnToNbaMap = {
    'WSH': 'WAS',  // Washington Wizards
    'NY': 'NYK',   // New York Knicks
    'GS': 'GSW',   // Golden State Warriors
    'UTAH': 'UTA', // Utah Jazz
    'SA': 'SAS',   // San Antonio Spurs
    'NO': 'NOP',   // New Orleans Pelicans
    'PHX': 'PHX',  // Phoenix Suns (igual en ambas APIs)
    'LAL': 'LAL', 'LAC': 'LAC', 'BOS': 'BOS', 'MIA': 'MIA',
    'CHI': 'CHI', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN',
    'DET': 'DET', 'HOU': 'HOU', 'IND': 'IND', 'MEM': 'MEM',
    'MIL': 'MIL', 'MIN': 'MIN', 'OKC': 'OKC', 'ORL': 'ORL',
    'PHI': 'PHI', 'POR': 'POR', 'SAC': 'SAC', 'TOR': 'TOR',
    'ATL': 'ATL', 'BKN': 'BKN', 'CHA': 'CHA'
};

/**
 * Convierte una abreviatura de equipo del formato ESPN al formato NBA CDN.
 * Si la abreviatura no existe en el mapa, devuelve la misma que se recibió
 * (por si ya está en formato NBA CDN o es desconocida).
 * 
 * @param {string} espnAbbr - Abreviatura del equipo en formato ESPN (ej: 'GS')
 * @returns {string} Abreviatura en formato NBA CDN (ej: 'GSW')
 */
function toNbaAbbr(espnAbbr) {
    return espnToNbaMap[espnAbbr] || espnAbbr;
}
