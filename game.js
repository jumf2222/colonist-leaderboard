// ============================================================
// CATAN - Web Version (Solo + Multiplayer)
// ============================================================

const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
const RES_COLORS = { wood: '#228B22', brick: '#B22222', sheep: '#90EE90', wheat: '#DAA520', ore: '#808080', desert: '#EDC9AF' };
const RES_LABELS = { wood: 'Wood', brick: 'Brick', sheep: 'Sheep', wheat: 'Wheat', ore: 'Ore' };
const PLAYER_COLORS = ['#2196F3', '#F44336', '#FF9800', '#9C27B0'];
const PLAYER_NAMES_DEFAULT = ['You', 'CPU 1', 'CPU 2', 'CPU 3'];
const HEX_SIZE = 52;
const BOARD_CX = 350, BOARD_CY = 310;

const TERRAIN_POOL = [
    'wood','wood','wood','wood',
    'brick','brick','brick',
    'sheep','sheep','sheep','sheep',
    'wheat','wheat','wheat','wheat',
    'ore','ore','ore',
    'desert'
];
const NUMBER_POOL = [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const HEX_COORDS = [
    {q:0,r:0},{q:1,r:0},{q:2,r:0},
    {q:-1,r:1},{q:0,r:1},{q:1,r:1},{q:2,r:1},
    {q:-2,r:2},{q:-1,r:2},{q:0,r:2},{q:1,r:2},{q:2,r:2},
    {q:-2,r:3},{q:-1,r:3},{q:0,r:3},{q:1,r:3},
    {q:-2,r:4},{q:-1,r:4},{q:0,r:4}
];

const COSTS = {
    road: { wood: 1, brick: 1 },
    settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
    city: { wheat: 2, ore: 3 },
    devCard: { sheep: 1, wheat: 1, ore: 1 }
};

// ============================================================
// MODE: 'solo' or 'multiplayer'
// ============================================================
let gameMode = null;
let mySlot = 0; // which player slot I am
let ws = null;  // WebSocket for multiplayer

// Game state - used in both modes
let game = {};

// ============================================================
// UTILITY
// ============================================================
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function hexToPixel(q, r) {
    return {
        x: HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r) + BOARD_CX,
        y: HEX_SIZE * (3/2 * r) + BOARD_CY
    };
}

function hexCorners(cx, cy) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i - 30);
        corners.push({ x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) });
    }
    return corners;
}

function vKey(x, y) { return `${Math.round(x*10)},${Math.round(y*10)}`; }
function eKey(v1, v2) { return [v1, v2].sort().join('|'); }
function dist(a, b) { return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2); }

// ============================================================
// MENU / LOBBY UI
// ============================================================

document.getElementById('solo-btn').addEventListener('click', () => {
    gameMode = 'solo';
    mySlot = 0;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    initSoloGame();
});

document.getElementById('mp-btn').addEventListener('click', () => {
    document.getElementById('menu-buttons').style.display = 'none';
    document.getElementById('mp-menu').style.display = 'block';
    connectWebSocket();
});

document.getElementById('mp-back-btn').addEventListener('click', () => {
    document.getElementById('mp-menu').style.display = 'none';
    document.getElementById('menu-buttons').style.display = 'flex';
    if (ws) { ws.close(); ws = null; }
});

document.getElementById('create-lobby-btn').addEventListener('click', () => {
    if (!ws || ws.readyState !== 1) { connectWebSocket(() => createLobby()); return; }
    createLobby();
});

function createLobby() {
    const name = document.getElementById('player-name').value || 'Player';
    ws.send(JSON.stringify({ type: 'createLobby', name }));
}

document.getElementById('join-code-btn').addEventListener('click', () => {
    const code = document.getElementById('join-code').value.trim();
    if (!code) return;
    const name = document.getElementById('player-name').value || 'Player';
    if (!ws || ws.readyState !== 1) { connectWebSocket(() => joinLobby(code, name)); return; }
    joinLobby(code, name);
});

function joinLobby(code, name) {
    ws.send(JSON.stringify({ type: 'joinLobby', lobbyId: code, name }));
}

document.getElementById('refresh-lobbies-btn').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'listLobbies' }));
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'startGame' }));
});

document.getElementById('leave-lobby-btn').addEventListener('click', () => {
    if (ws) { ws.close(); ws = null; }
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('mp-menu').style.display = 'block';
    connectWebSocket();
});

function connectWebSocket(onOpen) {
    if (ws && ws.readyState === 1) { if (onOpen) onOpen(); return; }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { if (onOpen) onOpen(); };
    ws.onmessage = (e) => handleWSMessage(JSON.parse(e.data));
    ws.onclose = () => {
        if (gameMode === 'multiplayer' && game.winner < 0) {
            logMsg('Disconnected from server');
        }
    };
}

function handleWSMessage(msg) {
    switch (msg.type) {
        case 'lobbyCreated':
            mySlot = 0;
            showLobbyScreen(msg.lobbyId);
            break;
        case 'lobbyJoined':
            mySlot = msg.slot;
            showLobbyScreen(msg.lobbyId);
            break;
        case 'lobbyUpdate':
            updateLobbyPlayers(msg);
            break;
        case 'lobbyList':
            showLobbyList(msg.lobbies);
            break;
        case 'gameState':
            gameMode = 'multiplayer';
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('game-container').style.display = 'flex';
            applyServerState(msg.state);
            render();
            break;
        case 'log':
            logMsg(msg.msg);
            break;
        case 'diceResult':
            updateDiceDisplay(msg.roll);
            break;
        case 'mustDiscard':
            showDiscardPrompt(msg.count);
            break;
        case 'chooseSteal':
            showStealPromptMP(msg.victims);
            break;
        case 'devCardDrawn':
            logMsg(`You drew: ${cardNameStr(msg.card)}`);
            break;
        case 'error':
            logMsg(`Error: ${msg.msg}`);
            break;
    }
}

function showLobbyScreen(lobbyId) {
    document.getElementById('mp-menu').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'block';
    document.getElementById('lobby-id-display').textContent = `#${lobbyId}`;
    document.getElementById('lobby-share').textContent = `Share code: ${lobbyId}`;
}

function updateLobbyPlayers(msg) {
    const container = document.getElementById('lobby-players');
    container.innerHTML = msg.players.map(p =>
        `<div class="lobby-player">
            <span class="slot-color" style="background:${PLAYER_COLORS[p.slot]}"></span>
            ${p.name}${p.isCPU ? ' (CPU)' : ''}
        </div>`
    ).join('');
    document.getElementById('start-game-btn').disabled = !msg.canStart || mySlot !== 0;
}

function showLobbyList(list) {
    const container = document.getElementById('lobby-list');
    if (list.length === 0) {
        container.innerHTML = '<div style="font-size:12px;opacity:0.5;margin:8px 0;">No open lobbies</div>';
        return;
    }
    container.innerHTML = list.map(l =>
        `<div class="lobby-item">
            <span>Lobby #${l.id} (${l.playerCount}/4 players)</span>
            <button onclick="joinLobbyFromList('${l.id}')">Join</button>
        </div>`
    ).join('');
}

window.joinLobbyFromList = function(id) {
    const name = document.getElementById('player-name').value || 'Player';
    joinLobby(id, name);
};

// ============================================================
// MULTIPLAYER: Apply server state
// ============================================================

function applyServerState(state) {
    mySlot = state.mySlot;

    // Rebuild vertexMap and edgeMap from arrays
    const vertexMap = new Map();
    state.vertices.forEach(v => vertexMap.set(v.key, v));
    const edgeMap = new Map();
    state.edges.forEach(e => edgeMap.set(e.key, e));

    // Convert player ports from array (server sends array, solo uses Set)
    const players = state.players.map((p, i) => ({
        ...p,
        resources: p.resources || { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
        devCards: p.devCards || [],
        ports: new Set(p.ports || [])
    }));

    game = {
        hexes: state.hexes,
        vertices: state.vertices,
        edges: state.edges,
        vertexMap,
        edgeMap,
        players,
        currentPlayer: state.currentPlayer,
        phase: state.phase,
        setupTurn: state.setupTurn,
        setupStep: state.setupStep,
        diceRolled: state.diceRolled,
        devCards: [], // server doesn't share deck
        devCardsRemaining: state.devCardsRemaining,
        robberHex: state.robberHex,
        pendingRobber: state.pendingRobber,
        pendingSteal: state.pendingSteal,
        pendingDiscard: state.pendingDiscard,
        devCardPlayedThisTurn: state.devCardPlayedThisTurn,
        longestRoadPlayer: state.longestRoadPlayer,
        largestArmyPlayer: state.largestArmyPlayer,
        buildMode: null,
        winner: state.winner,
        turnNumber: state.turnNumber,
        lastSetupSettlement: state.lastSetupSettlement,
        roadBuildingRemaining: state.roadBuildingRemaining
    };

    // Auto-set build mode for setup if it's my turn
    if (game.currentPlayer === mySlot && (game.phase === 'setup1' || game.phase === 'setup2')) {
        game.buildMode = game.setupStep === 'settlement' ? 'setup-settlement' : 'setup-road';
    }
    if (game.currentPlayer === mySlot && game.pendingRobber) {
        game.buildMode = 'robber';
        document.getElementById('robber-prompt').style.display = 'block';
    } else {
        document.getElementById('robber-prompt').style.display = 'none';
    }

    if (game.winner >= 0) showWinner();
}

function sendAction(action) {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'action', ...action }));
    }
}

// ============================================================
// SOLO MODE: Full local game logic
// ============================================================

function initSoloGame() {
    const terrains = shuffle(TERRAIN_POOL);
    const numbers = shuffle(NUMBER_POOL);
    let numIdx = 0;

    const hexes = HEX_COORDS.map((coord, i) => {
        const terrain = terrains[i];
        const pos = hexToPixel(coord.q, coord.r);
        return {
            id: i, q: coord.q, r: coord.r, terrain,
            number: terrain === 'desert' ? 7 : numbers[numIdx++],
            cx: pos.x, cy: pos.y,
            corners: hexCorners(pos.x, pos.y)
        };
    });

    const vertexMap = new Map();
    const edgeMap = new Map();
    const vertices = [];
    const edges = [];

    hexes.forEach(hex => {
        const cornerKeys = [];
        hex.corners.forEach(c => {
            const key = vKey(c.x, c.y);
            if (!vertexMap.has(key)) {
                const v = { id: vertices.length, x: c.x, y: c.y, key, hexes: [], building: null, player: -1, port: null };
                vertexMap.set(key, v);
                vertices.push(v);
            }
            vertexMap.get(key).hexes.push(hex.id);
            cornerKeys.push(key);
        });
        hex.vertexKeys = cornerKeys;
        for (let i = 0; i < 6; i++) {
            const k1 = cornerKeys[i], k2 = cornerKeys[(i + 1) % 6];
            const ek = eKey(k1, k2);
            if (!edgeMap.has(ek)) {
                const e = { id: edges.length, v1: k1, v2: k2, key: ek, road: null, player: -1 };
                edgeMap.set(ek, e);
                edges.push(e);
            }
        }
    });

    assignPorts(vertices);

    const devCards = shuffle([
        ...Array(14).fill('knight'),
        ...Array(5).fill('victoryPoint'),
        ...Array(2).fill('roadBuilding'),
        ...Array(2).fill('yearOfPlenty'),
        ...Array(2).fill('monopoly')
    ]);

    const players = Array.from({length: 4}, (_, i) => ({
        id: i, name: PLAYER_NAMES_DEFAULT[i], color: PLAYER_COLORS[i],
        resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
        devCards: [], playedKnights: 0, victoryPoints: 0,
        hasLongestRoad: false, hasLargestArmy: false,
        roads: 0, settlements: 0, cities: 0,
        ports: new Set(), isCPU: i > 0
    }));

    const desertIdx = hexes.findIndex(h => h.terrain === 'desert');

    game = {
        hexes, vertices, edges, vertexMap, edgeMap, players,
        currentPlayer: 0, phase: 'setup1', setupRound: 1, setupTurn: 0,
        setupStep: 'settlement', diceRolled: false, devCards,
        robberHex: desertIdx, pendingRobber: false, pendingSteal: false,
        pendingDiscard: null, devCardPlayedThisTurn: false,
        longestRoadPlayer: -1, largestArmyPlayer: -1,
        buildMode: null, winner: -1, turnNumber: 0,
        lastSetupSettlement: null, roadBuildingRemaining: 0
    };

    logMsg('Welcome to Catan! Place your first settlement.');
    runSoloSetup();
}

function assignPorts(vertices) {
    const boundaryVertices = vertices.filter(v => v.hexes.length <= 2);
    const portTypes = shuffle(['3:1','3:1','3:1','3:1','wood','brick','sheep','wheat','ore']);
    const assigned = new Set();
    let portIdx = 0;
    boundaryVertices.sort((a, b) => Math.atan2(a.y - BOARD_CY, a.x - BOARD_CX) - Math.atan2(b.y - BOARD_CY, b.x - BOARD_CX));
    for (let i = 0; i < boundaryVertices.length && portIdx < portTypes.length; i++) {
        const v = boundaryVertices[i];
        if (assigned.has(v.key)) continue;
        for (let j = i + 1; j < boundaryVertices.length; j++) {
            const u = boundaryVertices[j];
            if (assigned.has(u.key)) continue;
            if (dist(v, u) < HEX_SIZE * 1.2) {
                const type = portTypes[portIdx++];
                v.port = type; u.port = type;
                assigned.add(v.key); assigned.add(u.key);
                break;
            }
        }
    }
}

// ============================================================
// GAME LOGIC (used in solo mode only)
// ============================================================

function totalResources(player) {
    return Object.values(player.resources).reduce((s, v) => s + v, 0);
}

function canAfford(player, cost) {
    return Object.entries(cost).every(([r, amt]) => player.resources[r] >= amt);
}

function spend(player, cost) {
    Object.entries(cost).forEach(([r, amt]) => player.resources[r] -= amt);
}

function gain(player, res, amt = 1) {
    player.resources[res] += amt;
}

function getTradeRatio(player, resource) {
    if (player.ports.has(resource)) return 2;
    if (player.ports.has('3:1')) return 3;
    return 4;
}

function validSettlementVertices(playerIdx, isSetup) {
    return game.vertices.filter(v => {
        if (v.building) return false;
        const adj = getAdjacentVertices(v.key);
        if (adj.some(ak => { const av = game.vertexMap.get(ak); return av && av.building; })) return false;
        if (!isSetup) {
            const adjE = getAdjacentEdges(v.key);
            if (!adjE.some(ek => { const e = game.edgeMap.get(ek); return e && e.player === playerIdx; })) return false;
        }
        return true;
    });
}

function validRoadEdges(playerIdx, isSetup, lastSettlementKey) {
    return game.edges.filter(e => {
        if (e.player >= 0) return false;
        if (isSetup && lastSettlementKey) {
            return e.v1 === lastSettlementKey || e.v2 === lastSettlementKey;
        }
        const v1 = game.vertexMap.get(e.v1), v2 = game.vertexMap.get(e.v2);
        const canPassV1 = !v1.building || v1.player === playerIdx;
        const canPassV2 = !v2.building || v2.player === playerIdx;
        const roadV1 = getAdjacentEdgesAtVertex(e, e.v1).some(ek => { const ae = game.edgeMap.get(ek); return ae && ae.player === playerIdx; });
        const roadV2 = getAdjacentEdgesAtVertex(e, e.v2).some(ek => { const ae = game.edgeMap.get(ek); return ae && ae.player === playerIdx; });
        const validV1 = (v1 && v1.player === playerIdx) || (canPassV1 && roadV1);
        const validV2 = (v2 && v2.player === playerIdx) || (canPassV2 && roadV2);
        return validV1 || validV2;
    });
}

function validCityVertices(playerIdx) {
    return game.vertices.filter(v => v.building === 'settlement' && v.player === playerIdx);
}

function getAdjacentVertices(vk) {
    const result = [];
    game.edges.forEach(e => {
        if (e.v1 === vk) result.push(e.v2);
        else if (e.v2 === vk) result.push(e.v1);
    });
    return result;
}

function getAdjacentEdges(vk) {
    return game.edges.filter(e => e.v1 === vk || e.v2 === vk).map(e => e.key);
}

function getAdjacentEdgesForEdge(edge) {
    return game.edges.filter(e => e.key !== edge.key && (e.v1 === edge.v1 || e.v1 === edge.v2 || e.v2 === edge.v1 || e.v2 === edge.v2)).map(e => e.key);
}

function getAdjacentEdgesAtVertex(edge, vk) {
    return game.edges.filter(e => e.key !== edge.key && (e.v1 === vk || e.v2 === vk)).map(e => e.key);
}

function soloPlaceSettlement(playerIdx, vertex, isSetup) {
    vertex.building = 'settlement';
    vertex.player = playerIdx;
    game.players[playerIdx].settlements++;
    if (vertex.port) game.players[playerIdx].ports.add(vertex.port);
    if (game.phase === 'setup2') {
        vertex.hexes.forEach(hid => {
            const hex = game.hexes[hid];
            if (hex.terrain !== 'desert') gain(game.players[playerIdx], hex.terrain);
        });
    }
}

function soloPlaceRoad(playerIdx, edge) {
    edge.player = playerIdx;
    edge.road = true;
    game.players[playerIdx].roads++;
}

function soloPlaceCity(playerIdx, vertex) {
    vertex.building = 'city';
    game.players[playerIdx].settlements--;
    game.players[playerIdx].cities++;
}

function rollDiceValue() {
    return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function distributeResources(roll) {
    game.hexes.forEach(hex => {
        if (hex.number !== roll || hex.id === game.robberHex) return;
        hex.vertexKeys.forEach(vk => {
            const v = game.vertexMap.get(vk);
            if (v && v.building) {
                const amt = v.building === 'city' ? 2 : 1;
                gain(game.players[v.player], hex.terrain, amt);
            }
        });
    });
}

function calculateVP(playerIdx) {
    const p = game.players[playerIdx];
    let vp = p.settlements + p.cities * 2;
    vp += p.devCards.filter(c => c === 'victoryPoint').length;
    if (p.hasLongestRoad) vp += 2;
    if (p.hasLargestArmy) vp += 2;
    p.victoryPoints = vp;
    return vp;
}

function checkLongestRoad() {
    let best = -1, bestLen = 4;
    game.players.forEach((_, idx) => {
        const len = calcLongestRoad(idx);
        if (len > bestLen) { bestLen = len; best = idx; }
    });
    game.players.forEach(p => p.hasLongestRoad = false);
    if (best >= 0) { game.players[best].hasLongestRoad = true; game.longestRoadPlayer = best; }
}

function calcLongestRoad(playerIdx) {
    const playerEdges = game.edges.filter(e => e.player === playerIdx);
    if (playerEdges.length === 0) return 0;
    const adj = {};
    playerEdges.forEach(e => {
        if (!adj[e.v1]) adj[e.v1] = [];
        if (!adj[e.v2]) adj[e.v2] = [];
        adj[e.v1].push({ to: e.v2, edge: e.key });
        adj[e.v2].push({ to: e.v1, edge: e.key });
    });
    let maxLen = 0;
    Object.keys(adj).forEach(start => {
        const sv = game.vertexMap.get(start);
        if (sv && sv.building && sv.player !== playerIdx) return;
        const visited = new Set();
        (function dfs(node, length) {
            maxLen = Math.max(maxLen, length);
            (adj[node] || []).forEach(({to, edge}) => {
                if (visited.has(edge)) return;
                const tv = game.vertexMap.get(to);
                if (tv && tv.building && tv.player !== playerIdx) return;
                visited.add(edge);
                dfs(to, length + 1);
                visited.delete(edge);
            });
        })(start, 0);
    });
    return maxLen;
}

function checkLargestArmy() {
    let best = -1, bestCount = 2;
    game.players.forEach((p, idx) => { if (p.playedKnights > bestCount) { bestCount = p.playedKnights; best = idx; } });
    game.players.forEach(p => p.hasLargestArmy = false);
    if (best >= 0) { game.players[best].hasLargestArmy = true; game.largestArmyPlayer = best; }
}

function checkWinner() {
    for (let i = 0; i < 4; i++) {
        if (calculateVP(i) >= 10) { game.winner = i; return i; }
    }
    return -1;
}

// ============================================================
// CPU AI (solo mode)
// ============================================================

function cpuPlayTurn(playerIdx) {
    const p = game.players[playerIdx];
    const roll = rollDiceValue();
    game.diceRolled = true;
    logMsg(`${p.name} rolled ${roll}`);
    updateDiceDisplay(roll);

    if (roll === 7) {
        game.players.forEach((pl, i) => {
            const total = totalResources(pl);
            if (total > 7) cpuDiscard(i, Math.floor(total / 2));
        });
        cpuMoveRobber(playerIdx);
    } else {
        distributeResources(roll);
    }

    if (!game.devCardPlayedThisTurn) {
        const ki = p.devCards.indexOf('knight');
        if (ki >= 0) {
            p.devCards.splice(ki, 1);
            p.playedKnights++;
            checkLargestArmy();
            cpuMoveRobber(playerIdx);
            game.devCardPlayedThisTurn = true;
            logMsg(`${p.name} played a Knight`);
        }
    }

    cpuBuild(playerIdx);
    game.devCardPlayedThisTurn = false;
}

function cpuDiscard(playerIdx, count) {
    const p = game.players[playerIdx];
    for (let i = 0; i < count; i++) {
        const available = RESOURCES.filter(r => p.resources[r] > 0);
        if (available.length === 0) break;
        available.sort((a, b) => p.resources[b] - p.resources[a]);
        p.resources[available[0]]--;
    }
    logMsg(`${p.name} discarded ${count} cards`);
}

function cpuMoveRobber(playerIdx) {
    let bestHex = -1, bestScore = -1;
    game.hexes.forEach((hex, i) => {
        if (i === game.robberHex || hex.terrain === 'desert') return;
        let score = 0;
        hex.vertexKeys.forEach(vk => {
            const v = game.vertexMap.get(vk);
            if (v && v.building && v.player !== playerIdx) {
                score += v.building === 'city' ? 3 : 1;
                score += hex.number <= 7 ? hex.number - 1 : 13 - hex.number;
            }
        });
        if (score > bestScore) { bestScore = score; bestHex = i; }
    });
    if (bestHex >= 0) {
        game.robberHex = bestHex;
        const victims = new Set();
        game.hexes[bestHex].vertexKeys.forEach(vk => {
            const v = game.vertexMap.get(vk);
            if (v && v.building && v.player !== playerIdx && totalResources(game.players[v.player]) > 0) victims.add(v.player);
        });
        if (victims.size > 0) {
            const victim = [...victims][Math.floor(Math.random() * victims.size)];
            stealRandom(playerIdx, victim);
        }
    }
}

function stealRandom(thiefIdx, victimIdx) {
    const victim = game.players[victimIdx];
    const available = RESOURCES.filter(r => victim.resources[r] > 0);
    if (available.length === 0) return;
    const res = available[Math.floor(Math.random() * available.length)];
    victim.resources[res]--;
    game.players[thiefIdx].resources[res]++;
    logMsg(`${game.players[thiefIdx].name} stole from ${game.players[victimIdx].name}`);
}

function vertexProduction(vertex) {
    let score = 0;
    vertex.hexes.forEach(hid => {
        const hex = game.hexes[hid];
        if (hex.terrain === 'desert') return;
        const n = hex.number;
        score += n <= 7 ? n - 1 : 13 - n;
    });
    return score;
}

function resourceDiversity(vertex) {
    const types = new Set();
    vertex.hexes.forEach(hid => {
        const hex = game.hexes[hid];
        if (hex.terrain !== 'desert') types.add(hex.terrain);
    });
    return types.size;
}

function cpuBuild(playerIdx) {
    const p = game.players[playerIdx];
    for (let attempt = 0; attempt < 10; attempt++) {
        let built = false;
        if (canAfford(p, COSTS.city)) {
            const spots = validCityVertices(playerIdx);
            if (spots.length > 0) {
                spots.sort((a, b) => vertexProduction(b) - vertexProduction(a));
                spend(p, COSTS.city); soloPlaceCity(playerIdx, spots[0]);
                logMsg(`${p.name} built a City`); built = true; continue;
            }
        }
        if (canAfford(p, COSTS.settlement)) {
            const spots = validSettlementVertices(playerIdx, false);
            if (spots.length > 0) {
                spots.sort((a, b) => vertexProduction(b) - vertexProduction(a));
                spend(p, COSTS.settlement); soloPlaceSettlement(playerIdx, spots[0], false);
                logMsg(`${p.name} built a Settlement`); built = true; continue;
            }
        }
        if (canAfford(p, COSTS.devCard) && game.devCards.length > 0 && p.devCards.length < 5) {
            spend(p, COSTS.devCard); p.devCards.push(game.devCards.pop());
            logMsg(`${p.name} bought a Development Card`); built = true; continue;
        }
        if (canAfford(p, COSTS.road) && p.roads < 15) {
            const spots = validRoadEdges(playerIdx, false, null);
            if (spots.length > 0) {
                spend(p, COSTS.road); soloPlaceRoad(playerIdx, spots[Math.floor(Math.random() * spots.length)]);
                logMsg(`${p.name} built a Road`); built = true; continue;
            }
        }
        const needed = findNeededResource(playerIdx);
        if (needed) {
            const excess = RESOURCES.filter(r => r !== needed && p.resources[r] >= getTradeRatio(p, r));
            if (excess.length > 0) {
                excess.sort((a, b) => p.resources[b] - p.resources[a]);
                const giveRes = excess[0], ratio = getTradeRatio(p, giveRes);
                p.resources[giveRes] -= ratio; p.resources[needed]++;
                logMsg(`${p.name} traded ${ratio} ${giveRes} for 1 ${needed}`);
                continue;
            }
        }
        if (!built) break;
    }
}

function findNeededResource(playerIdx) {
    const p = game.players[playerIdx];
    const needs = {};
    RESOURCES.forEach(r => needs[r] = 0);
    Object.entries(COSTS.settlement).forEach(([r, amt]) => { if (p.resources[r] < amt) needs[r] += amt - p.resources[r]; });
    Object.entries(COSTS.city).forEach(([r, amt]) => { if (p.resources[r] < amt) needs[r] += (amt - p.resources[r]) * 0.5; });
    const sorted = RESOURCES.filter(r => needs[r] > 0).sort((a, b) => needs[b] - needs[a]);
    return sorted.length > 0 ? sorted[0] : null;
}

function cpuSetupPlace(playerIdx) {
    const p = game.players[playerIdx];
    if (game.setupStep === 'settlement') {
        const spots = validSettlementVertices(playerIdx, true);
        if (spots.length === 0) return;
        spots.sort((a, b) => (vertexProduction(b) + resourceDiversity(b) * 2) - (vertexProduction(a) + resourceDiversity(a) * 2));
        soloPlaceSettlement(playerIdx, spots[0], true);
        game.lastSetupSettlement = spots[0].key;
        game.setupStep = 'road';
        logMsg(`${p.name} placed a Settlement`);
    } else {
        const roads = validRoadEdges(playerIdx, true, game.lastSetupSettlement);
        if (roads.length === 0) return;
        soloPlaceRoad(playerIdx, roads[Math.floor(Math.random() * roads.length)]);
        game.setupStep = 'settlement';
        logMsg(`${p.name} placed a Road`);
    }
}

// ============================================================
// SOLO SETUP
// ============================================================

function runSoloSetup() {
    game.phase = 'setup1';
    game.setupTurn = 0;
    game.setupStep = 'settlement';
    startSoloSetupTurn();
}

function startSoloSetupTurn() {
    const order = game.phase === 'setup1' ? [0,1,2,3] : [3,2,1,0];
    if (game.setupTurn >= 4) {
        if (game.phase === 'setup1') {
            game.phase = 'setup2'; game.setupTurn = 0;
            startSoloSetupTurn(); return;
        } else {
            game.phase = 'play'; game.currentPlayer = 0; game.turnNumber = 1;
            logMsg('=== Game Start! ===');
            logMsg('--- Turn 1 ---');
            render(); return;
        }
    }
    const playerIdx = order[game.setupTurn];
    game.currentPlayer = playerIdx;
    game.setupStep = 'settlement';

    if (playerIdx === mySlot) {
        game.buildMode = 'setup-settlement';
        render();
    } else {
        cpuSetupPlace(playerIdx);
        cpuSetupPlace(playerIdx);
        game.setupTurn++;
        render();
        setTimeout(() => startSoloSetupTurn(), 100);
    }
}

function advanceSoloSetup() {
    game.setupTurn++;
    setTimeout(() => startSoloSetupTurn(), 100);
}

// ============================================================
// SOLO TURN MANAGEMENT
// ============================================================

function soloEndTurn() {
    game.diceRolled = false;
    game.devCardPlayedThisTurn = false;
    game.buildMode = null;
    game.roadBuildingRemaining = 0;
    updateDiceDisplay(null);

    for (let i = 1; i <= 3; i++) {
        game.currentPlayer = i;
        render();
        cpuPlayTurn(i);
        checkLongestRoad();
        if (checkWinner() >= 0) { showWinner(); render(); return; }
    }
    game.currentPlayer = 0;
    game.turnNumber++;
    logMsg(`--- Turn ${game.turnNumber} ---`);
    render();
}

// ============================================================
// RENDERING
// ============================================================

const canvas = document.getElementById('board-canvas');
const ctx = canvas.getContext('2d');

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOcean();
    drawHexes();
    drawPorts();
    drawRoads();
    drawBuildings();
    drawRobber();
    if (game.buildMode) drawBuildHighlights();
    updateUI();
}

function drawOcean() {
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2471a3';
    ctx.beginPath();
    ctx.arc(BOARD_CX, BOARD_CY + 15, 320, 0, Math.PI * 2);
    ctx.fill();
}

function drawHexes() {
    game.hexes.forEach(hex => {
        const corners = hex.corners;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fillStyle = RES_COLORS[hex.terrain];
        ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();

        const icons = { wood: '\u{1F332}', brick: '\u{1F9F1}', sheep: '\u{1F411}', wheat: '\u{1F33E}', ore: '\u{26F0}\uFE0F', desert: '\u{1F3DC}\uFE0F' };
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(icons[hex.terrain] || '', hex.cx, hex.cy - 8);

        if (hex.terrain !== 'desert') {
            ctx.beginPath();
            ctx.arc(hex.cx, hex.cy + 12, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#FFF8DC'; ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = (hex.number === 6 || hex.number === 8) ? '#c0392b' : '#333';
            ctx.fillText(hex.number, hex.cx, hex.cy + 12);
            const dots = hex.number <= 7 ? hex.number - 1 : 13 - hex.number;
            ctx.fillStyle = (hex.number === 6 || hex.number === 8) ? '#c0392b' : '#333';
            const dotStart = hex.cx - (dots - 1) * 3;
            for (let d = 0; d < dots; d++) {
                ctx.beginPath();
                ctx.arc(dotStart + d * 6, hex.cy + 23, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
}

function drawPorts() {
    game.vertices.forEach(v => {
        if (!v.port) return;
        ctx.save();
        const dx = v.x - BOARD_CX, dy = v.y - BOARD_CY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const px = v.x + (dx / len) * 18, py = v.y + (dy / len) * 18;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = v.port === '3:1' ? '#fff' : RES_COLORS[v.port];
        ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(v.port === '3:1' ? '3:1' : v.port[0].toUpperCase(), px, py);
        ctx.restore();
    });
}

function drawRoads() {
    game.edges.forEach(e => {
        if (e.player < 0) return;
        const v1 = game.vertexMap.get(e.v1), v2 = game.vertexMap.get(e.v2);
        ctx.beginPath(); ctx.moveTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y);
        ctx.strokeStyle = PLAYER_COLORS[e.player]; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    });
}

function drawBuildings() {
    game.vertices.forEach(v => {
        if (!v.building) return;
        if (v.building === 'settlement') {
            ctx.save(); ctx.translate(v.x, v.y);
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(8, -2); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.lineTo(-8, -2);
            ctx.closePath();
            ctx.fillStyle = PLAYER_COLORS[v.player]; ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(v.x, v.y);
            ctx.beginPath();
            ctx.moveTo(0, -14); ctx.lineTo(10, -4); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.lineTo(-10, -4);
            ctx.closePath();
            ctx.fillStyle = PLAYER_COLORS[v.player]; ctx.fill();
            ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        }
    });
}

function drawRobber() {
    const hex = game.hexes[game.robberHex];
    ctx.beginPath();
    ctx.arc(hex.cx, hex.cy - 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('R', hex.cx, hex.cy - 2);
}

function drawBuildHighlights() {
    if (game.buildMode === 'settlement' || game.buildMode === 'setup-settlement') {
        const isSetup = game.buildMode === 'setup-settlement';
        const spots = validSettlementVertices(game.currentPlayer, isSetup);
        spots.forEach(v => {
            ctx.beginPath(); ctx.arc(v.x, v.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; ctx.fill();
            ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();
        });
    } else if (game.buildMode === 'road' || game.buildMode === 'setup-road') {
        const isSetup = game.buildMode === 'setup-road';
        const lastKey = isSetup ? game.lastSetupSettlement : null;
        const spots = validRoadEdges(game.currentPlayer, isSetup, lastKey);
        spots.forEach(e => {
            const v1 = game.vertexMap.get(e.v1), v2 = game.vertexMap.get(e.v2);
            ctx.beginPath(); ctx.moveTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'; ctx.lineWidth = 8; ctx.stroke();
        });
    } else if (game.buildMode === 'city') {
        validCityVertices(game.currentPlayer).forEach(v => {
            ctx.beginPath(); ctx.arc(v.x, v.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.5)'; ctx.fill();
            ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();
        });
    } else if (game.buildMode === 'robber') {
        game.hexes.forEach((hex, i) => {
            if (i === game.robberHex) return;
            ctx.beginPath();
            const corners = hex.corners;
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let j = 1; j < 6; j++) ctx.lineTo(corners[j].x, corners[j].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; ctx.fill();
        });
    }
}

// ============================================================
// UI
// ============================================================

const cardNames = { knight: 'Knight', victoryPoint: 'Victory Point', roadBuilding: 'Road Building', yearOfPlenty: 'Year of Plenty', monopoly: 'Monopoly' };
function cardNameStr(type) { return cardNames[type] || type; }

function updateUI() {
    const scoresDiv = document.getElementById('player-scores');
    scoresDiv.innerHTML = game.players.map((p, i) => {
        calculateVP(i);
        const extras = [];
        if (p.hasLongestRoad) extras.push('LR');
        if (p.hasLargestArmy) extras.push('LA');
        const extraStr = extras.length > 0 ? ` [${extras.join(',')}]` : '';
        const isMe = i === mySlot;
        const totalCards = isMe ? '' : ` (${p.totalCards !== undefined ? p.totalCards : totalResources(p)} cards)`;
        return `<div class="player-score ${i === game.currentPlayer ? 'active' : ''}" style="background:${p.color}33;color:${p.color}">
            ${p.name}${isMe ? ' (you)' : ''}: ${p.victoryPoints} VP${extraStr}${totalCards}
            ${p.playedKnights > 0 ? `| ${p.playedKnights}K` : ''}
        </div>`;
    }).join('');

    const turnDiv = document.getElementById('turn-indicator');
    if (game.phase === 'setup1' || game.phase === 'setup2') {
        turnDiv.textContent = `Setup Phase ${game.phase === 'setup1' ? '1' : '2'} - ${game.players[game.currentPlayer].name}'s turn (${game.setupStep})`;
    } else {
        turnDiv.textContent = `Turn ${game.turnNumber} - ${game.players[game.currentPlayer].name}'s turn`;
    }

    const p = game.players[mySlot];
    const resDiv = document.getElementById('resource-counts');
    resDiv.innerHTML = RESOURCES.map(r =>
        `<div class="resource-item res-${r}"><span>${RES_LABELS[r]}</span><span class="count">${p.resources[r]}</span></div>`
    ).join('');

    const isMyTurn = game.currentPlayer === mySlot && game.phase === 'play';
    const notBlocked = !game.pendingRobber && !game.pendingSteal && !game.pendingDiscard;
    document.getElementById('roll-dice-btn').disabled = !isMyTurn || game.diceRolled || !notBlocked;
    document.getElementById('build-road-btn').disabled = !isMyTurn || !game.diceRolled || (!canAfford(p, COSTS.road) && !game.roadBuildingRemaining) || !notBlocked;
    document.getElementById('build-settlement-btn').disabled = !isMyTurn || !game.diceRolled || !canAfford(p, COSTS.settlement) || !notBlocked;
    document.getElementById('build-city-btn').disabled = !isMyTurn || !game.diceRolled || !canAfford(p, COSTS.city) || !notBlocked;
    document.getElementById('buy-dev-card-btn').disabled = !isMyTurn || !game.diceRolled || !canAfford(p, COSTS.devCard) || (gameMode === 'solo' ? game.devCards.length === 0 : (game.devCardsRemaining || 0) === 0) || !notBlocked;
    document.getElementById('end-turn-btn').disabled = !isMyTurn || !game.diceRolled || !notBlocked || game.roadBuildingRemaining > 0;
    document.getElementById('trade-btn').disabled = !isMyTurn || !game.diceRolled || !notBlocked;

    const devDiv = document.getElementById('dev-cards-list');
    const cardCounts = {};
    p.devCards.forEach(c => cardCounts[c] = (cardCounts[c] || 0) + 1);
    devDiv.innerHTML = Object.entries(cardCounts).map(([type, count]) => {
        const canPlay = isMyTurn && game.diceRolled && !game.devCardPlayedThisTurn && type !== 'victoryPoint' && notBlocked;
        return `<div class="dev-card-item">
            <span>${cardNameStr(type)} x${count}</span>
            ${canPlay ? `<button onclick="playDevCard('${type}')">Play</button>` : ''}
        </div>`;
    }).join('') || '<div style="font-size:12px;opacity:0.5">No cards</div>';

    updateTradeUI();
}

function updateTradeUI() {
    const giveSelect = document.getElementById('trade-give');
    const getSelect = document.getElementById('trade-get');
    const ratioSpan = document.getElementById('trade-ratio');
    const p = game.players[mySlot];

    if (!giveSelect.options.length) {
        RESOURCES.forEach(r => {
            giveSelect.add(new Option(RES_LABELS[r], r));
            getSelect.add(new Option(RES_LABELS[r], r));
        });
        getSelect.selectedIndex = 1;
    }
    ratioSpan.textContent = getTradeRatio(p, giveSelect.value);
}

function updateDiceDisplay(roll) {
    document.getElementById('dice-result').textContent = roll ? `\u{1F3B2} ${roll}` : '';
}

function logMsg(msg) {
    const log = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    log.appendChild(entry);
    log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

function showWinner() {
    const overlay = document.getElementById('winner-overlay');
    const msg = document.getElementById('winner-message');
    const winnerName = game.players[game.winner].name;
    msg.textContent = game.winner === mySlot ? 'You Win!' : `${winnerName} Wins!`;
    overlay.style.display = 'flex';
}

// ============================================================
// CLICK HANDLING
// ============================================================

canvas.addEventListener('click', (e) => {
    if (!game.hexes) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (game.buildMode === 'robber') {
        handleRobberClick(mx, my);
        return;
    }

    if (game.currentPlayer !== mySlot) return;

    if (game.buildMode === 'settlement' || game.buildMode === 'setup-settlement') {
        handleSettlementClick(mx, my);
    } else if (game.buildMode === 'road' || game.buildMode === 'setup-road') {
        handleRoadClick(mx, my);
    } else if (game.buildMode === 'city') {
        handleCityClick(mx, my);
    }
});

function handleSettlementClick(mx, my) {
    const isSetup = game.buildMode === 'setup-settlement';
    const spots = validSettlementVertices(mySlot, isSetup);
    const clicked = spots.find(v => dist(v, {x: mx, y: my}) < 15);
    if (!clicked) return;

    if (gameMode === 'multiplayer') {
        sendAction({ action: 'placeSettlement', vertexKey: clicked.key });
        game.buildMode = null;
    } else {
        if (!isSetup) spend(game.players[mySlot], COSTS.settlement);
        soloPlaceSettlement(mySlot, clicked, isSetup);
        logMsg('You placed a Settlement');
        if (isSetup) {
            game.lastSetupSettlement = clicked.key;
            game.buildMode = 'setup-road';
            game.setupStep = 'road';
        } else {
            game.buildMode = null;
        }
        checkLongestRoad();
        if (checkWinner() >= 0) showWinner();
    }
    render();
}

function handleRoadClick(mx, my) {
    const isSetup = game.buildMode === 'setup-road';
    const lastKey = isSetup ? game.lastSetupSettlement : null;
    const spots = validRoadEdges(mySlot, isSetup, lastKey);

    let bestEdge = null, bestDist = 15;
    spots.forEach(e => {
        const v1 = game.vertexMap.get(e.v1), v2 = game.vertexMap.get(e.v2);
        const midX = (v1.x + v2.x) / 2, midY = (v1.y + v2.y) / 2;
        const d = dist({x: mx, y: my}, {x: midX, y: midY});
        if (d < bestDist) { bestDist = d; bestEdge = e; }
    });
    if (!bestEdge) return;

    if (gameMode === 'multiplayer') {
        sendAction({ action: isSetup ? 'placeRoad' : 'buildRoad', edgeKey: bestEdge.key });
        game.buildMode = null;
    } else {
        if (!isSetup && !game.roadBuildingRemaining) spend(game.players[mySlot], COSTS.road);
        soloPlaceRoad(mySlot, bestEdge);
        logMsg('You placed a Road');
        if (game.roadBuildingRemaining > 0) {
            game.roadBuildingRemaining--;
            if (game.roadBuildingRemaining > 0) {
                game.buildMode = 'road';
                logMsg(`Place ${game.roadBuildingRemaining} more road(s)`);
            } else {
                game.buildMode = null;
            }
        } else {
            game.buildMode = null;
            game.setupStep = 'settlement';
        }
        checkLongestRoad();
        if (isSetup) advanceSoloSetup();
        if (checkWinner() >= 0) showWinner();
    }
    render();
}

function handleCityClick(mx, my) {
    const spots = validCityVertices(mySlot);
    const clicked = spots.find(v => dist(v, {x: mx, y: my}) < 15);
    if (!clicked) return;

    if (gameMode === 'multiplayer') {
        sendAction({ action: 'buildCity', vertexKey: clicked.key });
    } else {
        spend(game.players[mySlot], COSTS.city);
        soloPlaceCity(mySlot, clicked);
        logMsg('You upgraded to a City');
        if (checkWinner() >= 0) showWinner();
    }
    game.buildMode = null;
    render();
}

function handleRobberClick(mx, my) {
    for (let i = 0; i < game.hexes.length; i++) {
        const hex = game.hexes[i];
        if (i === game.robberHex) continue;
        if (dist({x: mx, y: my}, {x: hex.cx, y: hex.cy}) < HEX_SIZE * 0.7) {
            if (gameMode === 'multiplayer') {
                sendAction({ action: 'moveRobber', hexIdx: i });
                game.pendingRobber = false;
                game.buildMode = null;
                document.getElementById('robber-prompt').style.display = 'none';
            } else {
                game.robberHex = i;
                game.pendingRobber = false;
                game.buildMode = null;
                document.getElementById('robber-prompt').style.display = 'none';
                const victims = new Set();
                hex.vertexKeys.forEach(vk => {
                    const v = game.vertexMap.get(vk);
                    if (v && v.building && v.player !== mySlot && totalResources(game.players[v.player]) > 0) victims.add(v.player);
                });
                if (victims.size === 0) {
                    // nothing
                } else if (victims.size === 1) {
                    stealRandom(mySlot, [...victims][0]);
                } else {
                    game.pendingSteal = true;
                    showStealPromptSolo([...victims]);
                }
            }
            render();
            return;
        }
    }
}

function showStealPromptSolo(victims) {
    const promptEl = document.getElementById('steal-prompt');
    const btns = document.getElementById('steal-buttons');
    btns.innerHTML = victims.map(v =>
        `<button style="background:${PLAYER_COLORS[v]}" onclick="stealChoice(${v})">${game.players[v].name}</button>`
    ).join('');
    promptEl.style.display = 'block';
}

function showStealPromptMP(victims) {
    const promptEl = document.getElementById('steal-prompt');
    const btns = document.getElementById('steal-buttons');
    btns.innerHTML = victims.map(v =>
        `<button style="background:${PLAYER_COLORS[v]}" onclick="stealChoice(${v})">${game.players[v].name}</button>`
    ).join('');
    promptEl.style.display = 'block';
}

window.stealChoice = function(victimIdx) {
    if (gameMode === 'multiplayer') {
        sendAction({ action: 'steal', victim: victimIdx });
    } else {
        stealRandom(mySlot, victimIdx);
    }
    game.pendingSteal = false;
    document.getElementById('steal-prompt').style.display = 'none';
    render();
};

// ============================================================
// PLAYER ACTION BUTTONS
// ============================================================

document.getElementById('roll-dice-btn').addEventListener('click', () => {
    if (game.currentPlayer !== mySlot || game.diceRolled) return;
    if (gameMode === 'multiplayer') {
        sendAction({ action: 'rollDice' });
    } else {
        const roll = rollDiceValue();
        game.diceRolled = true;
        logMsg(`You rolled ${roll}`);
        updateDiceDisplay(roll);
        if (roll === 7) {
            let needsDiscard = false;
            game.players.forEach((pl, i) => {
                const total = totalResources(pl);
                if (total > 7) {
                    if (i === mySlot) {
                        needsDiscard = true;
                        showDiscardPrompt(Math.floor(total / 2));
                    } else {
                        cpuDiscard(i, Math.floor(total / 2));
                    }
                }
            });
            if (!needsDiscard) {
                game.pendingRobber = true;
                game.buildMode = 'robber';
                document.getElementById('robber-prompt').style.display = 'block';
            }
        } else {
            distributeResources(roll);
        }
        render();
    }
});

function showDiscardPrompt(count) {
    game.pendingDiscard = { count, selected: {} };
    RESOURCES.forEach(r => game.pendingDiscard.selected[r] = 0);
    document.getElementById('discard-count').textContent = count;
    updateDiscardUI();
    document.getElementById('discard-prompt').style.display = 'block';
}

function updateDiscardUI() {
    const disc = game.pendingDiscard;
    const p = game.players[mySlot];
    const container = document.getElementById('discard-resources');
    container.innerHTML = RESOURCES.map(r => {
        const avail = p.resources[r];
        const sel = disc.selected[r];
        return `<div>
            <div style="text-align:center;font-size:12px;margin-bottom:4px">${RES_LABELS[r]}: ${avail}</div>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="discard-res-btn" style="background:${RES_COLORS[r]}" onclick="discardAdjust('${r}',-1)">-</button>
                <span style="min-width:20px;text-align:center">${sel}</span>
                <button class="discard-res-btn" style="background:${RES_COLORS[r]}" onclick="discardAdjust('${r}',1)">+</button>
            </div>
        </div>`;
    }).join('');
    const totalSelected = Object.values(disc.selected).reduce((s, v) => s + v, 0);
    document.getElementById('discard-confirm-btn').disabled = totalSelected !== disc.count;
}

window.discardAdjust = function(res, delta) {
    const disc = game.pendingDiscard;
    const p = game.players[mySlot];
    const newVal = disc.selected[res] + delta;
    if (newVal < 0 || newVal > p.resources[res]) return;
    const totalSelected = Object.values(disc.selected).reduce((s, v) => s + v, 0) + delta;
    if (totalSelected > disc.count) return;
    disc.selected[res] = newVal;
    updateDiscardUI();
};

document.getElementById('discard-confirm-btn').addEventListener('click', () => {
    const disc = game.pendingDiscard;
    if (gameMode === 'multiplayer') {
        sendAction({ action: 'discard', discards: disc.selected });
    } else {
        const p = game.players[mySlot];
        RESOURCES.forEach(r => p.resources[r] -= disc.selected[r]);
        const total = Object.values(disc.selected).reduce((s, v) => s + v, 0);
        logMsg(`You discarded ${total} cards`);
        game.pendingRobber = true;
        game.buildMode = 'robber';
        document.getElementById('robber-prompt').style.display = 'block';
    }
    game.pendingDiscard = null;
    document.getElementById('discard-prompt').style.display = 'none';
    render();
});

document.getElementById('build-road-btn').addEventListener('click', () => {
    game.buildMode = game.buildMode === 'road' ? null : 'road';
    render();
});

document.getElementById('build-settlement-btn').addEventListener('click', () => {
    game.buildMode = game.buildMode === 'settlement' ? null : 'settlement';
    render();
});

document.getElementById('build-city-btn').addEventListener('click', () => {
    game.buildMode = game.buildMode === 'city' ? null : 'city';
    render();
});

document.getElementById('buy-dev-card-btn').addEventListener('click', () => {
    const p = game.players[mySlot];
    if (!canAfford(p, COSTS.devCard)) return;
    if (gameMode === 'multiplayer') {
        sendAction({ action: 'buyDevCard' });
    } else {
        if (game.devCards.length === 0) return;
        spend(p, COSTS.devCard);
        const card = game.devCards.pop();
        p.devCards.push(card);
        logMsg(`You bought a ${cardNameStr(card)}`);
        if (checkWinner() >= 0) showWinner();
        render();
    }
});

document.getElementById('end-turn-btn').addEventListener('click', () => {
    if (game.currentPlayer !== mySlot || !game.diceRolled) return;
    if (gameMode === 'multiplayer') {
        sendAction({ action: 'endTurn' });
    } else {
        soloEndTurn();
    }
});

document.getElementById('trade-give').addEventListener('change', () => { updateTradeUI(); });

document.getElementById('trade-btn').addEventListener('click', () => {
    const p = game.players[mySlot];
    const giveRes = document.getElementById('trade-give').value;
    const getRes = document.getElementById('trade-get').value;
    if (giveRes === getRes) { logMsg('Cannot trade same resource'); return; }
    const ratio = getTradeRatio(p, giveRes);
    if (p.resources[giveRes] < ratio) { logMsg(`Need ${ratio} ${RES_LABELS[giveRes]} to trade`); return; }

    if (gameMode === 'multiplayer') {
        sendAction({ action: 'trade', give: giveRes, get: getRes });
    } else {
        p.resources[giveRes] -= ratio;
        p.resources[getRes]++;
        logMsg(`You traded ${ratio} ${RES_LABELS[giveRes]} for 1 ${RES_LABELS[getRes]}`);
        render();
    }
});

window.playDevCard = function(type) {
    const p = game.players[mySlot];
    const idx = p.devCards.indexOf(type);
    if (idx < 0) return;

    if (gameMode === 'multiplayer') {
        if (type === 'yearOfPlenty') {
            const r1 = prompt('Choose first resource: wood, brick, sheep, wheat, ore');
            const r2 = prompt('Choose second resource: wood, brick, sheep, wheat, ore');
            sendAction({ action: 'playDevCard', cardType: type, resource1: r1, resource2: r2 });
        } else if (type === 'monopoly') {
            const res = prompt('Choose resource to monopolize: wood, brick, sheep, wheat, ore');
            sendAction({ action: 'playDevCard', cardType: type, resource: res });
        } else {
            sendAction({ action: 'playDevCard', cardType: type });
        }
        return;
    }

    // Solo mode
    p.devCards.splice(idx, 1);
    game.devCardPlayedThisTurn = true;

    if (type === 'knight') {
        p.playedKnights++;
        checkLargestArmy();
        game.pendingRobber = true;
        game.buildMode = 'robber';
        document.getElementById('robber-prompt').style.display = 'block';
        logMsg('You played a Knight');
    } else if (type === 'roadBuilding') {
        game.roadBuildingRemaining = 2;
        game.buildMode = 'road';
        logMsg('You played Road Building - place 2 roads');
    } else if (type === 'yearOfPlenty') {
        const r1 = prompt('Choose first resource: wood, brick, sheep, wheat, ore');
        const r2 = prompt('Choose second resource: wood, brick, sheep, wheat, ore');
        if (RESOURCES.includes(r1)) gain(p, r1);
        if (RESOURCES.includes(r2)) gain(p, r2);
        logMsg('You played Year of Plenty');
    } else if (type === 'monopoly') {
        const res = prompt('Choose resource to monopolize: wood, brick, sheep, wheat, ore');
        if (RESOURCES.includes(res)) {
            let total = 0;
            for (let i = 0; i < 4; i++) {
                if (i === mySlot) continue;
                total += game.players[i].resources[res];
                game.players[i].resources[res] = 0;
            }
            p.resources[res] += total;
            logMsg(`You played Monopoly on ${RES_LABELS[res]}, got ${total}`);
        }
    }
    if (checkWinner() >= 0) showWinner();
    render();
};
