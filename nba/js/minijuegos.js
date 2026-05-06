// ============================================================
// minijuegos.js - Selector de minijuegos + modos mejorados
// Trivia dinamica, Guess con racha y Ahorcado de jugador/equipo.
// ============================================================

const MINI_GAME_LABELS = {
    trivia: 'Trivia Live',
    guess: 'Guess The Team',
    hangman: 'Ahorcado NBA'
};

const TRIVIA_FALLBACK_QUESTIONS = [
    {
        id: 'fallback-1',
        question: 'Que franquicia suma mas titulos NBA historicos?',
        options: ['Boston Celtics', 'Los Angeles Lakers', 'Chicago Bulls', 'Golden State Warriors'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-2',
        question: 'Cuantos jugadores por equipo hay en cancha durante un partido NBA?',
        options: ['4', '5', '6', '7'],
        answerIndex: 1,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-3',
        question: 'Cual de estas estadisticas equivale a asistencia?',
        options: ['AST', 'REB', 'BLK', 'STL'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-4',
        question: 'En temporada regular NBA, cuantos cuartos se juegan?',
        options: ['2', '3', '4', '5'],
        answerIndex: 2,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-5',
        question: 'Que equipo juega en San Francisco?',
        options: ['Warriors', 'Kings', 'Clippers', 'Suns'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-6',
        question: 'Cual es el valor de un tiro libre?',
        options: ['1 punto', '2 puntos', '3 puntos', 'Depende del cuarto'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-7',
        question: 'Que significa MVP?',
        options: ['Most Valuable Player', 'Most Verified Play', 'Main Victory Point', 'Most Vertical Player'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-8',
        question: 'Cuantos puntos vale un triple?',
        options: ['1', '2', '3', '4'],
        answerIndex: 2,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-9',
        question: 'Que equipo ha ganado seis anillos con Michael Jordan?',
        options: ['Chicago Bulls', 'Detroit Pistons', 'New York Knicks', 'Miami Heat'],
        answerIndex: 0,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-10',
        question: 'La abreviatura NBA de Phoenix Suns es...',
        options: ['PHI', 'PHX', 'PHO', 'PHS'],
        answerIndex: 1,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-11',
        question: 'Que jugador es conocido como King James?',
        options: ['Kevin Durant', 'LeBron James', 'Kawhi Leonard', 'Giannis Antetokounmpo'],
        answerIndex: 1,
        source: 'Base local NBA'
    },
    {
        id: 'fallback-12',
        question: 'Que conferencia incluye a los Milwaukee Bucks?',
        options: ['Este', 'Oeste', 'Central', 'Pacifico'],
        answerIndex: 0,
        source: 'Base local NBA'
    }
];

const TEAM_CITY_BY_ABBR = {
    ATL: 'Atlanta',
    BOS: 'Boston',
    BKN: 'Brooklyn',
    CHA: 'Charlotte',
    CHI: 'Chicago',
    CLE: 'Cleveland',
    DAL: 'Dallas',
    DEN: 'Denver',
    DET: 'Detroit',
    GSW: 'San Francisco',
    HOU: 'Houston',
    IND: 'Indiana',
    LAC: 'Los Angeles',
    LAL: 'Los Angeles',
    MEM: 'Memphis',
    MIA: 'Miami',
    MIL: 'Milwaukee',
    MIN: 'Minnesota',
    NOP: 'New Orleans',
    NYK: 'New York',
    OKC: 'Oklahoma City',
    ORL: 'Orlando',
    PHI: 'Philadelphia',
    PHX: 'Phoenix',
    POR: 'Portland',
    SAC: 'Sacramento',
    SAS: 'San Antonio',
    TOR: 'Toronto',
    UTA: 'Utah',
    WAS: 'Washington'
};

const HANGMAN_MAX_ERRORS = 6;
const TEAM_HANGMAN_POOL = [
    {
        answer: 'LAKERS',
        label: 'Los Angeles Lakers',
        softHint: 'Conferencia Oeste y colores oro/purpura.',
        deepHint: 'Franquicia angelina con LeBron como gran referente reciente.'
    },
    {
        answer: 'KNICKS',
        label: 'New York Knicks',
        softHint: 'Equipo de la Conferencia Este en una gran ciudad.',
        deepHint: 'Juegan en el Madison Square Garden.'
    },
    {
        answer: 'SPURS',
        label: 'San Antonio Spurs',
        softHint: 'Franquicia texana del Oeste.',
        deepHint: 'Su leyenda moderna se asocia a Tim Duncan y Popovich.'
    },
    {
        answer: 'BULLS',
        label: 'Chicago Bulls',
        softHint: 'Franquicia del Este con enorme legado noventero.',
        deepHint: 'Ganaron seis anillos en la era Jordan.'
    },
    {
        answer: 'MAGIC',
        label: 'Orlando Magic',
        softHint: 'Equipo del Este en Florida.',
        deepHint: 'Su nombre alude a la fantasia y juega en Orlando.'
    },
    {
        answer: 'PACERS',
        label: 'Indiana Pacers',
        softHint: 'Franquicia del Este muy ligada a Indiana.',
        deepHint: 'Su identidad historica se relaciona con Reggie Miller.'
    },
    {
        answer: 'CELTICS',
        label: 'Boston Celtics',
        softHint: 'Franquicia verde y blanca del Este.',
        deepHint: 'Equipo historico de Boston con muchisimos titulos.'
    },
    {
        answer: 'RAPTORS',
        label: 'Toronto Raptors',
        softHint: 'Unico equipo canadiense de la NBA.',
        deepHint: 'Ganaron el anillo en 2019 con Kawhi Leonard.'
    },
    {
        answer: 'NUGGETS',
        label: 'Denver Nuggets',
        softHint: 'Franquicia del Oeste en altura.',
        deepHint: 'Campeones recientes con Nikola Jokic como figura.'
    },
    {
        answer: 'WARRIORS',
        label: 'Golden State Warriors',
        softHint: 'Franquicia de la Bahia en California.',
        deepHint: 'Equipo ligado a Stephen Curry y al tiro de tres.'
    }
];

const PLAYER_HANGMAN_POOL = [
    {
        answer: 'CURRY',
        label: 'Stephen Curry',
        softHint: 'Base historico por su tiro exterior.',
        deepHint: 'Lidero dinastias recientes en Golden State.'
    },
    {
        answer: 'DONCIC',
        label: 'Luka Doncic',
        softHint: 'Base/alero europeo de altisimo uso ofensivo.',
        deepHint: 'Superestrella eslovena actualmente en Los Angeles.'
    },
    {
        answer: 'JOKIC',
        label: 'Nikola Jokic',
        softHint: 'Pivot serbio con vision de juego elite.',
        deepHint: 'Figura principal de Denver y multiple MVP.'
    },
    {
        answer: 'TATUM',
        label: 'Jayson Tatum',
        softHint: 'Alero anotador y estrella de Boston.',
        deepHint: 'Lider de los Celtics en los ultimos anos.'
    },
    {
        answer: 'BOOKER',
        label: 'Devin Booker',
        softHint: 'Escolta con gran arsenal ofensivo en el Oeste.',
        deepHint: 'Juega en Phoenix y anoto 70 puntos en un partido.'
    },
    {
        answer: 'BUTLER',
        label: 'Jimmy Butler',
        softHint: 'Alero competitivo famoso por su intensidad.',
        deepHint: 'Lidero varias carreras de playoff con Miami.'
    },
    {
        answer: 'HARDEN',
        label: 'James Harden',
        softHint: 'Escolta/base zurdo de gran uno contra uno.',
        deepHint: 'Conocido por su barba y su etapa dominante en Houston.'
    },
    {
        answer: 'MORANT',
        label: 'Ja Morant',
        softHint: 'Base explosivo del Oeste.',
        deepHint: 'Principal figura de Memphis en transicion rapida.'
    },
    {
        answer: 'BROWN',
        label: 'Jaylen Brown',
        softHint: 'Alero/escolta atletico de Boston.',
        deepHint: 'Companero de Tatum y MVP de unas Finales recientes.'
    },
    {
        answer: 'BRUNSON',
        label: 'Jalen Brunson',
        softHint: 'Base de elite ofensiva en la Conferencia Este.',
        deepHint: 'Lider actual de New York Knicks en ataque.'
    }
];

let activeMiniGame = 'trivia';

let triviaScore = 0;
let guessScore = 0;
let hangmanScore = 0;
let guessStreak = 0;

let triviaQuestionBank = [...TRIVIA_FALLBACK_QUESTIONS];
let triviaQueue = [];
let triviaApiLoaded = false;
let currentTriviaQuestion = null;
let triviaAnswered = false;
let triviaLastShownQuestion = null;

let currentGuessRound = null;
let guessAnswered = false;

let hangmanMode = 'team';
let hangmanTargetEntry = null;
let hangmanWordSize = 0;
let hangmanErrors = 0;
let hangmanFinished = false;
let hangmanHintState = { soft: false, deep: false };
let hangmanRevealedMask = [];
const hangmanUsedLetters = new Set();

function normalizeWord(value) {
    return String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z]/g, '');
}

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function pickRandomDistinct(array, count) {
    return shuffleArray(array).slice(0, count);
}

function getTeamPool() {
    if (Array.isArray(window.NBA_TEAM_OPTIONS) && window.NBA_TEAM_OPTIONS.length >= 4) {
        return window.NBA_TEAM_OPTIONS;
    }

    return [
        { abbr: 'BOS', name: 'Boston Celtics' },
        { abbr: 'LAL', name: 'Los Angeles Lakers' },
        { abbr: 'GSW', name: 'Golden State Warriors' },
        { abbr: 'MIA', name: 'Miami Heat' },
        { abbr: 'NYK', name: 'New York Knicks' },
        { abbr: 'PHX', name: 'Phoenix Suns' }
    ];
}

function getTeamCityByAbbr(abbr, teamName) {
    if (TEAM_CITY_BY_ABBR[abbr]) return TEAM_CITY_BY_ABBR[abbr];

    const words = String(teamName || '').trim().split(/\s+/);
    if (words.length <= 1) return teamName || 'Ciudad';

    return words.slice(0, Math.max(1, words.length - 1)).join(' ');
}

// Sincroniza las monedas al servidor con debounce para no spamear la API
let _coinsSyncTimer = null;
function _syncCoinsToServer(coins) {
    if (_coinsSyncTimer) clearTimeout(_coinsSyncTimer);
    _coinsSyncTimer = setTimeout(function () {
        const token = localStorage.getItem('nba_token');
        if (!token) return;
        const apiBase = (typeof API_SERVER === 'string' && API_SERVER.trim()) ? API_SERVER : 'http://localhost:3000';
        fetch(`${apiBase}/api/users/coins`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ coins })
        }).catch(err => console.warn('No se pudo sincronizar monedas con el servidor:', err));
    }, 2000);
}

function updateUserCoins(delta) {
    if (!Number.isFinite(delta) || delta === 0) return;

    try {
        const userRaw = localStorage.getItem('nba_user');
        if (!userRaw) return;

        const user = JSON.parse(userRaw);
        const currentCoins = Number(user.coins || 0);
        user.coins = Math.max(0, currentCoins + delta);

        localStorage.setItem('nba_user', JSON.stringify(user));

        const coinsElement = document.getElementById('userCoins');
        if (coinsElement) {
            coinsElement.textContent = `🪙 ${user.coins}`;
        }

        // Sincronizar con Supabase (con debounce de 2s)
        _syncCoinsToServer(user.coins);
    } catch (error) {
        console.warn('No se pudieron actualizar monedas del usuario:', error);
    }
}

function awardMiniGameCoins(amount) {
    if (!amount || amount < 1) return;
    updateUserCoins(Math.abs(amount));
    saveScoreToServer(activeMiniGame, Math.abs(amount));
}

// Guardar puntuación en Supabase
function saveScoreToServer(gameType, score) {
    try {
        const token = localStorage.getItem('nba_token');
        if (!token) return; // Solo guardamos si está logueado

        const apiBase = (typeof API_SERVER === 'string' && API_SERVER.trim()) ? API_SERVER : 'http://localhost:3000';

        fetch(`${apiBase}/api/minigame-score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ game_type: gameType, score: score })
        }).catch(err => console.warn('No se pudo guardar puntuación:', err));
    } catch (e) {
        console.warn('Error guardando puntuación:', e);
    }
}

function spendMiniGameCoins(amount) {
    if (!amount || amount < 1) return;
    updateUserCoins(-Math.abs(amount));
}

function setMiniGameFeedback(elementId, message, isSuccess) {
    const feedback = document.getElementById(elementId);
    if (!feedback) return;

    feedback.textContent = message;
    feedback.classList.remove('success', 'error');

    if (!message) return;
    feedback.classList.add(isSuccess ? 'success' : 'error');
}

function setActiveMinigameLabel(gameId) {
    const label = document.getElementById('minigame-active-label');
    if (!label) return;

    label.textContent = MINI_GAME_LABELS[gameId] || 'MiniGame';
}

function selectMiniGame(gameId) {
    if (!MINI_GAME_LABELS[gameId]) return;

    activeMiniGame = gameId;

    Object.keys(MINI_GAME_LABELS).forEach(id => {
        const tab = document.getElementById(`minigame-tab-${id}`);
        const panel = document.getElementById(`minigame-panel-${id}`);

        if (tab) tab.classList.toggle('active', id === gameId);
        if (panel) panel.classList.toggle('active', id === gameId);
    });

    setActiveMinigameLabel(gameId);
}

function updateMiniGameScoreLabels() {
    const triviaScoreLabel = document.getElementById('trivia-score');
    const guessScoreLabel = document.getElementById('guess-team-score');
    const guessStreakLabel = document.getElementById('guess-team-streak');
    const hangmanScoreLabel = document.getElementById('hangman-score');

    if (triviaScoreLabel) {
        triviaScoreLabel.textContent = `Aciertos: ${triviaScore}`;
    }

    if (guessScoreLabel) {
        guessScoreLabel.textContent = `Aciertos: ${guessScore}`;
    }

    if (guessStreakLabel) {
        guessStreakLabel.textContent = `Racha: ${guessStreak}`;
    }

    if (hangmanScoreLabel) {
        hangmanScoreLabel.textContent = `Victorias: ${hangmanScore}`;
    }
}

function setTriviaSourceLabel(source) {
    const sourceLabel = document.getElementById('trivia-source');
    if (!sourceLabel) return;

    sourceLabel.textContent = `Fuente: ${source || 'Trivia NBA'}`;
}

function buildTriviaOptions(question) {
    return question.options
        .map((option, index) => `
            <button class="trivia-option-btn" type="button" onclick="answerTriviaQuestion(${index})">${option}</button>
        `)
        .join('');
}

function rebuildTriviaQueue() {
    const shuffled = shuffleArray([...triviaQuestionBank]);
    // Avoid starting the new cycle with the same question that just finished the last one
    if (triviaLastShownQuestion && shuffled.length > 1 &&
        shuffled[0].question === triviaLastShownQuestion.question) {
        const temp = shuffled[0];
        shuffled[0] = shuffled[1];
        shuffled[1] = temp;
    }
    triviaQueue = shuffled;
}

function getNextTriviaQuestion() {
    if (triviaQueue.length === 0) {
        rebuildTriviaQueue();
    }

    const question = triviaQueue.shift() || null;
    if (question) triviaLastShownQuestion = question;
    return question;
}

function mergeTriviaQuestions(apiQuestions) {
    const merged = [...apiQuestions, ...TRIVIA_FALLBACK_QUESTIONS];
    const byQuestionText = new Map();

    merged.forEach(question => {
        if (!question || !question.question || !Array.isArray(question.options)) return;
        if (question.options.length !== 4) return;
        if (question.answerIndex < 0 || question.answerIndex > 3) return;

        const key = String(question.question).toLowerCase().trim();
        if (!key) return;

        byQuestionText.set(key, question);
    });

    triviaQuestionBank = [...byQuestionText.values()];
    rebuildTriviaQueue();
}

function nextTriviaQuestion() {
    const questionElement = document.getElementById('trivia-question');
    const optionsElement = document.getElementById('trivia-options');

    if (!questionElement || !optionsElement) return;

    currentTriviaQuestion = getNextTriviaQuestion();
    if (!currentTriviaQuestion) return;

    triviaAnswered = false;
    questionElement.textContent = currentTriviaQuestion.question;
    optionsElement.innerHTML = buildTriviaOptions(currentTriviaQuestion);
    setTriviaSourceLabel(currentTriviaQuestion.source);
    setMiniGameFeedback('trivia-feedback', '', false);
}

function answerTriviaQuestion(selectedIndex) {
    if (!currentTriviaQuestion || triviaAnswered) return;

    triviaAnswered = true;
    const parsedIndex = Number(selectedIndex);
    const isCorrect = parsedIndex === currentTriviaQuestion.answerIndex;
    const optionButtons = document.querySelectorAll('#trivia-options .trivia-option-btn');

    optionButtons.forEach((button, buttonIndex) => {
        button.disabled = true;

        if (buttonIndex === currentTriviaQuestion.answerIndex) {
            button.classList.add('correct');
        } else if (buttonIndex === parsedIndex) {
            button.classList.add('wrong');
        }
    });

    if (isCorrect) {
        const reward = currentTriviaQuestion.source === 'ESPN API' ? 18 : 14;
        triviaScore += 1;
        updateMiniGameScoreLabels();
        awardMiniGameCoins(reward);
        setMiniGameFeedback('trivia-feedback', `Correcto! +${reward} monedas`, true);
        return;
    }

    const correctAnswer = currentTriviaQuestion.options[currentTriviaQuestion.answerIndex];
    setMiniGameFeedback('trivia-feedback', `Incorrecto. Respuesta: ${correctAnswer}`, false);
}

function getEntryStat(entry, statName) {
    const stats = Array.isArray(entry?.stats) ? entry.stats : [];
    const found = stats.find(stat => stat?.name === statName || stat?.type === statName);

    return found?.displayValue || found?.value || null;
}

function buildSeedOptions(seed) {
    const options = new Set([Number(seed)]);

    while (options.size < 4) {
        const randomDelta = randomItem([-4, -3, -2, -1, 1, 2, 3, 4]);
        const candidate = Math.max(1, Math.min(15, Number(seed) + randomDelta));
        options.add(candidate);
    }

    return shuffleArray([...options]).map(value => String(value));
}

async function buildTriviaFromStandingsApi() {
    const questions = [];

    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings');
    if (!response.ok) return questions;

    const data = await response.json();
    const conferences = Array.isArray(data?.children) ? data.children : [];

    conferences.forEach(conference => {
        const entries = Array.isArray(conference?.standings?.entries) ? conference.standings.entries : [];
        if (entries.length < 4) return;

        const sorted = [...entries].sort((a, b) => {
            const seedA = Number(getEntryStat(a, 'playoffSeed')) || 99;
            const seedB = Number(getEntryStat(b, 'playoffSeed')) || 99;
            return seedA - seedB;
        });

        const confLabel = conference?.abbreviation === 'East'
            ? 'Este'
            : conference?.abbreviation === 'West'
                ? 'Oeste'
                : conference?.name || 'NBA';

        const leaderName = sorted[0]?.team?.displayName;
        const otherNames = pickRandomDistinct(
            sorted.slice(1).map(entry => entry?.team?.displayName).filter(Boolean),
            3
        );

        if (leaderName && otherNames.length === 3) {
            const options = shuffleArray([leaderName, ...otherNames]);
            questions.push({
                id: `api-leader-${confLabel}`,
                question: `Segun ESPN en directo, quien lidera la Conferencia ${confLabel}?`,
                options,
                answerIndex: options.indexOf(leaderName),
                source: 'ESPN API'
            });
        }

        const sampleEntry = randomItem(sorted.slice(0, Math.min(sorted.length, 10)));
        const sampleTeamName = sampleEntry?.team?.displayName;
        const sampleSeed = Number(getEntryStat(sampleEntry, 'playoffSeed')) || null;

        if (sampleTeamName && sampleSeed) {
            const seedOptions = buildSeedOptions(sampleSeed);
            questions.push({
                id: `api-seed-${sampleTeamName}`,
                question: `Que puesto de conferencia tiene ${sampleTeamName} segun ESPN?`,
                options: seedOptions,
                answerIndex: seedOptions.indexOf(String(sampleSeed)),
                source: 'ESPN API'
            });
        }
    });

    return questions;
}

async function buildTriviaFromTeamsApi() {
    const questions = [];

    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams');
    if (!response.ok) return questions;

    const data = await response.json();
    const teamsRaw = data?.sports?.[0]?.leagues?.[0]?.teams;
    const teams = Array.isArray(teamsRaw)
        ? teamsRaw.map(item => item?.team).filter(team => team?.displayName && team?.abbreviation)
        : [];

    if (teams.length < 8) return questions;

    for (let i = 0; i < 4; i += 1) {
        const team = randomItem(teams);
        if (!team) continue;

        const wrongAbbr = pickRandomDistinct(
            teams
                .filter(candidate => candidate?.abbreviation !== team.abbreviation)
                .map(candidate => candidate.abbreviation),
            3
        );

        if (wrongAbbr.length === 3) {
            const options = shuffleArray([team.abbreviation, ...wrongAbbr]);
            questions.push({
                id: `api-abbr-${team.id}-${i}`,
                question: `Cual es la abreviatura NBA de ${team.displayName}?`,
                options,
                answerIndex: options.indexOf(team.abbreviation),
                source: 'ESPN API'
            });
        }

        const city = String(team.location || '').trim();
        const wrongTeams = pickRandomDistinct(
            teams
                .filter(candidate => candidate?.displayName !== team.displayName)
                .map(candidate => candidate.displayName),
            3
        );

        if (city && wrongTeams.length === 3) {
            const options = shuffleArray([team.displayName, ...wrongTeams]);
            questions.push({
                id: `api-city-${team.id}-${i}`,
                question: `Que equipo juega en ${city}?`,
                options,
                answerIndex: options.indexOf(team.displayName),
                source: 'ESPN API'
            });
        }
    }

    return questions;
}

async function loadTriviaQuestionsFromApi() {
    try {
        const [standingQuestions, teamQuestions] = await Promise.all([
            buildTriviaFromStandingsApi(),
            buildTriviaFromTeamsApi()
        ]);

        const questions = [...standingQuestions, ...teamQuestions].filter(question =>
            question
            && Array.isArray(question.options)
            && question.options.length === 4
            && question.answerIndex >= 0
        );

        return questions;
    } catch (error) {
        console.warn('No se pudieron generar preguntas de API:', error);
        return [];
    }
}

async function reloadTriviaFromApi(silent) {
    const isSilent = Boolean(silent);

    if (!isSilent) {
        setMiniGameFeedback('trivia-feedback', 'Actualizando preguntas NBA desde API...', true);
    }

    const apiQuestions = await loadTriviaQuestionsFromApi();

    if (apiQuestions.length > 0) {
        triviaApiLoaded = true;
        mergeTriviaQuestions(apiQuestions);

        if (!isSilent) {
            setMiniGameFeedback('trivia-feedback', `Preguntas actualizadas: ${apiQuestions.length} nuevas.`, true);
            nextTriviaQuestion();
        }
    } else if (!isSilent) {
        setMiniGameFeedback('trivia-feedback', 'No se pudo cargar API, seguimos con base local.', false);
    }
}

function buildGuessRound() {
    const teamPool = getTeamPool();
    const correctTeam = randomItem(teamPool);
    const wrongTeams = shuffleArray(teamPool.filter(team => team.abbr !== correctTeam.abbr)).slice(0, 3);
    const optionTeams = shuffleArray([correctTeam, ...wrongTeams]);
    const promptType = Math.random() < 0.5 ? 'abbr' : 'city';

    const promptValue = promptType === 'abbr'
        ? correctTeam.abbr
        : getTeamCityByAbbr(correctTeam.abbr, correctTeam.name);

    return {
        promptType,
        promptValue,
        correctTeam,
        optionTeams
    };
}

function nextGuessTeamRound() {
    const abbrElement = document.getElementById('guess-team-abbr');
    const optionsElement = document.getElementById('guess-team-options');

    if (!abbrElement || !optionsElement) return;

    currentGuessRound = buildGuessRound();
    guessAnswered = false;

    const promptTitle = currentGuessRound.promptType === 'abbr' ? 'ABR' : 'CITY';
    abbrElement.textContent = `${promptTitle}: ${currentGuessRound.promptValue}`;

    optionsElement.innerHTML = currentGuessRound.optionTeams
        .map((team, index) => `
            <button class="trivia-option-btn" type="button" onclick="answerGuessTeam(${index})">${team.name}</button>
        `)
        .join('');

    setMiniGameFeedback('guess-team-feedback', '', false);
}

function answerGuessTeam(selectedIndex) {
    if (!currentGuessRound || guessAnswered) return;

    guessAnswered = true;

    const selectedTeam = currentGuessRound.optionTeams[Number(selectedIndex)];
    const isCorrect = selectedTeam && selectedTeam.abbr === currentGuessRound.correctTeam.abbr;
    const optionButtons = document.querySelectorAll('#guess-team-options .trivia-option-btn');

    optionButtons.forEach((button, buttonIndex) => {
        button.disabled = true;

        const team = currentGuessRound.optionTeams[buttonIndex];
        if (team && team.abbr === currentGuessRound.correctTeam.abbr) {
            button.classList.add('correct');
        } else if (buttonIndex === Number(selectedIndex)) {
            button.classList.add('wrong');
        }
    });

    if (isCorrect) {
        guessScore += 1;
        guessStreak += 1;

        const reward = 8 + Math.min(guessStreak, 5) * 2;
        awardMiniGameCoins(reward);

        updateMiniGameScoreLabels();
        setMiniGameFeedback('guess-team-feedback', `Excelente! +${reward} monedas`, true);
        return;
    }

    guessStreak = 0;
    updateMiniGameScoreLabels();
    setMiniGameFeedback(
        'guess-team-feedback',
        `No fue correcto. Era: ${currentGuessRound.correctTeam.name}`,
        false
    );
}

function getHangmanPoolByMode(mode) {
    return mode === 'player' ? PLAYER_HANGMAN_POOL : TEAM_HANGMAN_POOL;
}

function updateHangmanModeUI() {
    const teamBtn = document.getElementById('hangman-mode-team-btn');
    const playerBtn = document.getElementById('hangman-mode-player-btn');
    const modeDescription = document.getElementById('hangman-mode-description');

    if (teamBtn) teamBtn.classList.toggle('active', hangmanMode === 'team');
    if (playerBtn) playerBtn.classList.toggle('active', hangmanMode === 'player');

    if (modeDescription) {
        modeDescription.textContent = hangmanMode === 'team'
            ? 'Modo equipo: adivina el nombre del equipo, letra por letra.'
            : 'Modo jugador: adivina el apellido del jugador, letra por letra.';
    }
}

function updateHangmanWordInputMeta() {
    const input = document.getElementById('hangman-word-input');
    if (!input) return;

    input.maxLength = hangmanWordSize;
    input.placeholder = `Adivina la palabra completa (${hangmanWordSize} letras)`;
}

function buildHangmanMask(answer) {
    return String(answer || '').split('').map(letter => (letter === ' ' ? ' ' : '_'));
}

function renderHangmanWordDisplay() {
    const wordDisplay = document.getElementById('hangman-word-display');
    if (!wordDisplay) return;

    wordDisplay.innerHTML = hangmanRevealedMask
        .map(letter => {
            if (letter === ' ') {
                return '<span class="hangman-letter-slot space">&nbsp;</span>';
            }

            const isRevealed = letter !== '_';
            return `<span class="hangman-letter-slot ${isRevealed ? 'revealed' : ''}">${isRevealed ? letter : '&nbsp;'}</span>`;
        })
        .join('');
}

function renderHangmanStatus() {
    const livesLabel = document.getElementById('hangman-lives');
    const usedLabel = document.getElementById('hangman-used-letters');
    const remainingLives = Math.max(HANGMAN_MAX_ERRORS - hangmanErrors, 0);

    if (livesLabel) {
        livesLabel.textContent = `Vidas: ${remainingLives}`;
    }

    if (usedLabel) {
        const letters = [...hangmanUsedLetters].sort().join(', ');
        usedLabel.textContent = `Letras usadas: ${letters || '-'}`;
    }
}

function clearHangmanInputs() {
    const letterInput = document.getElementById('hangman-letter-input');
    const wordInput = document.getElementById('hangman-word-input');

    if (letterInput) {
        letterInput.value = '';
        letterInput.focus();
    }

    if (wordInput) {
        wordInput.value = '';
    }
}

function setHangmanHintText(message) {
    const hintText = document.getElementById('hangman-hint-text');
    if (!hintText) return;

    hintText.textContent = message || '';
}

function isHangmanSolved() {
    return !hangmanRevealedMask.includes('_');
}

function revealHangmanLetter(letter) {
    const normalizedLetter = normalizeWord(letter).slice(0, 1);
    if (!normalizedLetter || !hangmanTargetEntry) return 0;

    let matches = 0;
    for (let i = 0; i < hangmanTargetEntry.answer.length; i += 1) {
        if (hangmanTargetEntry.answer[i] === normalizedLetter && hangmanRevealedMask[i] === '_') {
            hangmanRevealedMask[i] = normalizedLetter;
            matches += 1;
        }
    }

    return matches;
}

function finishHangmanWin(bonus) {
    const extraBonus = Number.isFinite(bonus) ? bonus : 0;

    hangmanFinished = true;
    hangmanScore += 1;
    updateMiniGameScoreLabels();

    const baseReward = hangmanMode === 'player' ? 24 : 20;
    const reward = baseReward + Math.max(extraBonus, 0);

    awardMiniGameCoins(reward);
    renderHangmanWordDisplay();
    renderHangmanStatus();
    setMiniGameFeedback('hangman-feedback', `Ganaste! Era ${hangmanTargetEntry.label}. +${reward} monedas`, true);
}

function finishHangmanLoss() {
    if (!hangmanTargetEntry) return;

    hangmanFinished = true;
    hangmanRevealedMask = hangmanTargetEntry.answer.split('');
    renderHangmanWordDisplay();
    renderHangmanStatus();
    setMiniGameFeedback('hangman-feedback', `Sin vidas. La palabra era ${hangmanTargetEntry.label}.`, false);
}

function startNewHangmanRound() {
    const pool = getHangmanPoolByMode(hangmanMode);
    if (!Array.isArray(pool) || pool.length === 0) return;

    hangmanTargetEntry = randomItem(pool);
    hangmanWordSize = hangmanTargetEntry.answer.length;
    hangmanErrors = 0;
    hangmanFinished = false;
    hangmanHintState = { soft: false, deep: false };
    hangmanRevealedMask = buildHangmanMask(hangmanTargetEntry.answer);
    hangmanUsedLetters.clear();

    updateHangmanModeUI();
    updateHangmanWordInputMeta();
    renderHangmanWordDisplay();
    renderHangmanStatus();
    clearHangmanInputs();
    setHangmanHintText('');
    setMiniGameFeedback('hangman-feedback', `Nueva ronda: palabra de ${hangmanWordSize} letras.`, true);
}

function requestHangmanHint(level) {
    if (!hangmanTargetEntry || hangmanFinished) {
        setMiniGameFeedback('hangman-feedback', 'Empieza una ronda para usar pistas.', false);
        return;
    }

    const normalizedLevel = level === 'deep' ? 'deep' : 'soft';
    if (hangmanHintState[normalizedLevel]) {
        setMiniGameFeedback('hangman-feedback', 'Esa pista ya fue usada en esta ronda.', false);
        return;
    }

    if (normalizedLevel === 'soft') {
        hangmanHintState.soft = true;
        spendMiniGameCoins(3);

        setHangmanHintText(`${hangmanTargetEntry.softHint} Tiene ${hangmanWordSize} letras.`);
        setMiniGameFeedback('hangman-feedback', 'Pista suave desbloqueada (-3 monedas).', true);
        return;
    }

    hangmanHintState.deep = true;
    spendMiniGameCoins(7);

    const firstLetter = hangmanTargetEntry.answer[0];
    const lastLetter = hangmanTargetEntry.answer[hangmanTargetEntry.answer.length - 1];

    hangmanUsedLetters.add(firstLetter);
    revealHangmanLetter(firstLetter);

    if (lastLetter !== firstLetter) {
        hangmanUsedLetters.add(lastLetter);
        revealHangmanLetter(lastLetter);
    }

    renderHangmanWordDisplay();
    renderHangmanStatus();
    setHangmanHintText(`${hangmanTargetEntry.deepHint} Empieza por ${firstLetter} y termina por ${lastLetter}.`);

    if (isHangmanSolved()) {
        finishHangmanWin(0);
        return;
    }

    setMiniGameFeedback('hangman-feedback', 'Pista detallada desbloqueada (-7 monedas).', true);
}

function submitHangmanLetter() {
    if (!hangmanTargetEntry) return;

    if (hangmanFinished) {
        setMiniGameFeedback('hangman-feedback', 'Ronda terminada. Pulsa Nueva palabra.', false);
        return;
    }

    const input = document.getElementById('hangman-letter-input');
    if (!input) return;

    const letter = normalizeWord(input.value).slice(0, 1);
    input.value = '';

    if (!letter) {
        setMiniGameFeedback('hangman-feedback', 'Escribe una letra valida.', false);
        return;
    }

    if (hangmanUsedLetters.has(letter)) {
        setMiniGameFeedback('hangman-feedback', 'Esa letra ya la usaste.', false);
        return;
    }

    hangmanUsedLetters.add(letter);
    const matches = revealHangmanLetter(letter);

    if (matches > 0) {
        renderHangmanWordDisplay();
        renderHangmanStatus();

        if (isHangmanSolved()) {
            finishHangmanWin(0);
            return;
        }

        setMiniGameFeedback('hangman-feedback', `Bien! La letra ${letter} aparece ${matches} vez/veces.`, true);
        return;
    }

    hangmanErrors += 1;
    renderHangmanStatus();

    if (hangmanErrors >= HANGMAN_MAX_ERRORS) {
        finishHangmanLoss();
        return;
    }

    const remainingLives = HANGMAN_MAX_ERRORS - hangmanErrors;
    setMiniGameFeedback('hangman-feedback', `La letra ${letter} no esta. Te quedan ${remainingLives} vidas.`, false);
}

function submitHangmanWord() {
    if (!hangmanTargetEntry) return;

    if (hangmanFinished) {
        setMiniGameFeedback('hangman-feedback', 'Ronda terminada. Pulsa Nueva palabra.', false);
        return;
    }

    const input = document.getElementById('hangman-word-input');
    if (!input) return;

    const guess = normalizeWord(input.value);
    input.value = '';

    if (guess.length !== hangmanWordSize) {
        setMiniGameFeedback('hangman-feedback', `La palabra debe tener ${hangmanWordSize} letras.`, false);
        return;
    }

    if (guess === hangmanTargetEntry.answer) {
        hangmanRevealedMask = hangmanTargetEntry.answer.split('');
        finishHangmanWin(4);
        return;
    }

    hangmanErrors += 2;
    renderHangmanStatus();

    if (hangmanErrors >= HANGMAN_MAX_ERRORS) {
        finishHangmanLoss();
        return;
    }

    const remainingLives = HANGMAN_MAX_ERRORS - hangmanErrors;
    setMiniGameFeedback('hangman-feedback', `No era esa palabra. Pierdes 2 vidas, te quedan ${remainingLives}.`, false);
}

function setHangmanMode(mode) {
    const normalizedMode = mode === 'player' ? 'player' : 'team';
    if (hangmanMode === normalizedMode && hangmanTargetEntry) {
        return;
    }

    hangmanMode = normalizedMode;
    startNewHangmanRound();
}

function resetHangmanGame() {
    startNewHangmanRound();
}

function bindHangmanEvents() {
    const letterInput = document.getElementById('hangman-letter-input');
    const wordInput = document.getElementById('hangman-word-input');

    if (letterInput) {
        letterInput.addEventListener('input', () => {
            letterInput.value = normalizeWord(letterInput.value).slice(0, 1);
        });

        letterInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submitHangmanLetter();
        });
    }

    if (wordInput) {
        wordInput.addEventListener('input', () => {
            wordInput.value = normalizeWord(wordInput.value);
        });

        wordInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submitHangmanWord();
        });
    }
}

function resetMiniGames() {
    triviaScore = 0;
    guessScore = 0;
    hangmanScore = 0;
    guessStreak = 0;

    updateMiniGameScoreLabels();
    rebuildTriviaQueue();
    nextTriviaQuestion();
    nextGuessTeamRound();
    resetHangmanGame();
    selectMiniGame('trivia');

    setMiniGameFeedback('trivia-feedback', 'MiniGames reiniciados.', true);
    setMiniGameFeedback('guess-team-feedback', '', false);
    setMiniGameFeedback('hangman-feedback', '', false);
}

async function initMiniGames() {
    const hasMainPanel = document.getElementById('minigame-panel-trivia');
    if (!hasMainPanel) return;

    updateMiniGameScoreLabels();
    selectMiniGame('trivia');

    rebuildTriviaQueue();
    nextTriviaQuestion();

    nextGuessTeamRound();
    bindHangmanEvents();
    setHangmanMode('team');

    await reloadTriviaFromApi(true);

    if (triviaApiLoaded) {
        setTriviaSourceLabel('ESPN API + base local');
        setMiniGameFeedback('trivia-feedback', 'Preguntas NBA actualizadas desde API.', true);
    }
}

window.initMiniGames = initMiniGames;
window.selectMiniGame = selectMiniGame;
window.reloadTriviaFromApi = reloadTriviaFromApi;
window.nextTriviaQuestion = nextTriviaQuestion;
window.answerTriviaQuestion = answerTriviaQuestion;
window.nextGuessTeamRound = nextGuessTeamRound;
window.answerGuessTeam = answerGuessTeam;
window.setHangmanMode = setHangmanMode;
window.requestHangmanHint = requestHangmanHint;
window.submitHangmanLetter = submitHangmanLetter;
window.submitHangmanWord = submitHangmanWord;
window.resetHangmanGame = resetHangmanGame;
window.resetMiniGames = resetMiniGames;
