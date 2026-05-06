// ============================================================
// clasificacion.js - Standings / Clasificación de la NBA
// Carga la clasificación de las conferencias Este y Oeste
// desde ESPN y las renderiza como tablas con formato visual
// que distingue entre plazas de Playoffs y Play-In.
// ============================================================

/**
 * Carga los standings (clasificación) de la NBA desde ESPN a través del servidor proxy.
 * Separa los datos en Conferencia Este y Conferencia Oeste y los renderiza
 * en sus contenedores respectivos.
 */
async function loadStandings() {
    const eastContainer = document.getElementById('east-standings');
    const westContainer = document.getElementById('west-standings');
    
    // Si no existen los contenedores en el DOM, no hace nada
    if (!eastContainer || !westContainer) return;
    
    eastContainer.innerHTML = '<h3>🏀 Conferencia Este</h3><div class="loading">Cargando clasificación...</div>';
    westContainer.innerHTML = '<h3>🏀 Conferencia Oeste</h3><div class="loading">Cargando clasificación...</div>';
    
    try {
        const response = await fetch(`${API_SERVER}/api/standings`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // La respuesta de ESPN tiene un array 'children' donde cada elemento es una conferencia
        const conferences = data.children || [];
        
        // Busca cada conferencia por nombre o abreviatura
        const eastConference = conferences.find(c => c.name === 'Eastern Conference' || c.abbreviation === 'East');
        const westConference = conferences.find(c => c.name === 'Western Conference' || c.abbreviation === 'West');
        
        if (eastConference) {
            // standings.entries contiene un array con los equipos y sus estadísticas
            renderESPNStandings(eastContainer, 'Conferencia Este', eastConference.standings?.entries || []);
        } else {
            eastContainer.innerHTML = '<h3>🏀 Conferencia Este</h3><p>No hay datos disponibles</p>';
        }
        
        if (westConference) {
            renderESPNStandings(westContainer, 'Conferencia Oeste', westConference.standings?.entries || []);
        } else {
            westContainer.innerHTML = '<h3>🏀 Conferencia Oeste</h3><p>No hay datos disponibles</p>';
        }
        
    } catch (error) {
        console.error('Error cargando standings:', error);
        eastContainer.innerHTML = `<h3>🏀 Conferencia Este</h3><div class="error-message"><p>Error: ${error.message}</p></div>`;
        westContainer.innerHTML = `<h3>🏀 Conferencia Oeste</h3><div class="error-message"><p>Error: ${error.message}</p></div>`;
    }
}

/**
 * Renderiza la tabla de clasificación de una conferencia.
 * Destaca visualmente las posiciones de Playoffs (1-6) y Play-In (7-10)
 * con clases CSS distintas. Muestra: posición, equipo, victorias, derrotas,
 * porcentaje, diferencial, racha y récord de últimos 10 partidos.
 * 
 * @param {HTMLElement} container - Elemento del DOM donde se renderiza la tabla
 * @param {string}      title    - Título de la conferencia ("Conferencia Este/Oeste")
 * @param {Array}       entries  - Array de entries (equipos con stats) de ESPN
 */
function renderESPNStandings(container, title, entries) {
    if (!entries || entries.length === 0) {
        container.innerHTML = `<h3>🏀 ${title}</h3><p>No hay datos disponibles</p>`;
        return;
    }
    
    /**
     * Función helper para extraer una estadística concreta del array de stats.
     * Cada stat en ESPN es un objeto con { name, type, displayValue, value }.
     * Busca por nombre o tipo y devuelve el valor formateado o '-' si no existe.
     * 
     * @param {Array}  stats - Array de objetos de estadísticas del equipo
     * @param {string} name  - Nombre de la stat a buscar (ej: 'wins', 'losses')
     * @returns {string} El valor de la stat o '-' si no se encontró
     */
    const getStat = (stats, name) => {
        const stat = stats.find(s => s.name === name || s.type === name);
        return stat ? (stat.displayValue || stat.value || '-') : '-';
    };
    
    // Ordena los equipos por su semilla de playoffs (playoffSeed)
    // Si no tiene seed, le asigna 99 para que vaya al final
    const sortedEntries = [...entries].sort((a, b) => {
        const seedA = parseFloat(getStat(a.stats, 'playoffSeed')) || 99;
        const seedB = parseFloat(getStat(b.stats, 'playoffSeed')) || 99;
        return seedA - seedB;
    });
    
    container.innerHTML = `
        <h3>🏀 ${title}</h3>
        <table class="standings-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th>V</th>
                    <th>D</th>
                    <th>%</th>
                    <th>Dif.</th>
                    <th>Racha</th>
                    <th>L10</th>
                </tr>
            </thead>
            <tbody>
                ${sortedEntries.slice(0, 15).map((entry, index) => {
                    const team = entry.team;
                    const stats = entry.stats || [];
                    
                    // Extrae cada estadística relevante
                    const wins = getStat(stats, 'wins');
                    const losses = getStat(stats, 'losses');
                    const pct = getStat(stats, 'winPercent');       // Porcentaje de victorias
                    const diff = getStat(stats, 'differential');    // Diferencial de puntos
                    const streak = getStat(stats, 'streak');        // Racha actual (ej: "W3")
                    const l10 = getStat(stats, 'lasttengames');     // Record en últimos 10 juegos
                    const seed = parseInt(getStat(stats, 'playoffSeed')) || (index + 1);
                    
                    // Aplica clase CSS según la posición en la tabla:
                    // - playoff-spot (verde): posiciones 1-6, clasifican directo a playoffs
                    // - playin-spot (amarillo): posiciones 7-10, van al torneo Play-In
                    let rowClass = '';
                    if (seed <= 6) rowClass = 'playoff-spot';
                    else if (seed <= 10) rowClass = 'playin-spot';
                    
                    // Determina si el diferencial es positivo o negativo para colorear
                    const diffNum = parseFloat(diff);
                    const diffClass = diffNum > 0 ? 'positive' : diffNum < 0 ? 'negative' : '';
                    
                    return `
                        <tr class="${rowClass}">
                            <td class="rank">${seed}</td>
                            <td class="team-name-cell">${team.displayName || team.name}</td>
                            <td>${wins}</td>
                            <td>${losses}</td>
                            <td>${pct}</td>
                            <td class="${diffClass}">${diffNum > 0 ? '+' : ''}${diff}</td>
                            <td>${streak}</td>
                            <td>${l10}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="standings-legend">
            <span class="legend-item playoff">● Playoffs (1-6)</span>
            <span class="legend-item playin">● Play-In (7-10)</span>
        </div>
    `;
}
