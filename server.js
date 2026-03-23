const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 3000;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

// Static file server
const httpServer = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server: httpServer });

// ============================================================
// SHARED GAME CONSTANTS
// ============================================================
const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
const PLAYER_COLORS = ['#2196F3', '#F44336', '#FF9800', '#9C27B0'];
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
// LOBBIES
// ============================================================
const lobbies = new Map();
let lobbyCounter = 0;

function createLobby(hostWs, hostName) {
    const id = String(++lobbyCounter);
    const lobby = {
        id,
        players: [{ ws: hostWs, name: hostName, slot: 0 }],
        cpuSlots: new Set([1, 2, 3]), // remaining slots are CPU by default
        started: false,
        game: null
    };
    lobbies.set(id, lobby);
    return lobby;
}

function broadcastLobby(lobby) {
    const info = {
        type: 'lobbyUpdate',
        lobbyId: lobby.id,
        players: [0,1,2,3].map(i => {
            const human = lobby.players.find(p => p.slot === i);
            if (human) return { slot: i, name: human.name, isCPU: false };
            return { slot: i, name: `CPU ${i}`, isCPU: true };
        }),
        canStart: lobby.players.length >= 1
    };
    lobby.players.forEach(p => send(p.ws, info));
}

function send(ws, data) {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ============================================================
// SERVER GAME STATE (mirrors client logic but authoritative)
// ============================================================

function initServerGame(lobby) {
    const terrains = shuffle(TERRAIN_POOL);
    const numbers = shuffle(NUMBER_POOL);
    let numIdx = 0;

    const hexes = HEX_COORDS.map((coord, i) => {
        const terrain = terrains[i];
        const pos = hexToPixel(coord.q, coord.r);
        const corners = hexCorners(pos.x, pos.y);
        return { id: i, q: coord.q, r: coord.r, terrain, number: terrain === 'desert' ? 7 : numbers[numIdx++], cx: pos.x, cy: pos.y, corners };
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

    const playerNames = [0,1,2,3].map(i => {
        const human = lobby.players.find(p => p.slot === i);
        return human ? human.name : `CPU ${i + 1}`;
    });

    const players = Array.from({length: 4}, (_, i) => ({
        id: i,
        name: playerNames[i],
        color: PLAYER_COLORS[i],
        resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
        devCards: [],
        playedKnights: 0,
        victoryPoints: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        roads: 0,
        settlements: 0,
        cities: 0,
        ports: [],
        isCPU: lobby.cpuSlots.has(i)
    }));

    const devCards = shuffle([
        ...Array(14).fill('knight'),
        ...Array(5).fill('victoryPoint'),
        ...Array(2).fill('roadBuilding'),
        ...Array(2).fill('yearOfPlenty'),
        ...Array(2).fill('monopoly')
    ]);

    const desertIdx = hexes.findIndex(h => h.terrain === 'desert');

    const game = {
        hexes, vertices, edges, vertexMap, edgeMap, players, devCards,
        currentPlayer: 0,
        phase: 'setup1',
        setupTurn: 0,
        setupStep: 'settlement',
        diceRolled: false,
        robberHex: desertIdx,
        pendingRobber: false,
        pendingSteal: false,
        pendingDiscard: null,
        discardQueue: [],
        devCardPlayedThisTurn: false,
        longestRoadPlayer: -1,
        largestArmyPlayer: -1,
        buildMode: null,
        winner: -1,
        turnNumber: 0,
        lastSetupSettlement: null,
        roadBuildingRemaining: 0,
        logs: []
    };

    lobby.game = game;
    return game;
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
// GAME LOGIC HELPERS (server-side)
// ============================================================

function totalResources(p) { return Object.values(p.resources).reduce((s, v) => s + v, 0); }
function canAfford(p, cost) { return Object.entries(cost).every(([r, a]) => p.resources[r] >= a); }
function spend(p, cost) { Object.entries(cost).forEach(([r, a]) => p.resources[r] -= a); }
function gain(p, res, amt = 1) { p.resources[res] += amt; }

function getTradeRatio(p, resource) {
    if (p.ports.includes(resource)) return 2;
    if (p.ports.includes('3:1')) return 3;
    return 4;
}

function getAdjacentVertices(g, vk) {
    const result = [];
    g.edges.forEach(e => {
        if (e.v1 === vk) result.push(e.v2);
        else if (e.v2 === vk) result.push(e.v1);
    });
    return result;
}

function getAdjacentEdges(g, vk) {
    return g.edges.filter(e => e.v1 === vk || e.v2 === vk).map(e => e.key);
}

function getAdjacentEdgesAtVertex(g, edge, vk) {
    return g.edges.filter(e => e.key !== edge.key && (e.v1 === vk || e.v2 === vk)).map(e => e.key);
}

function validSettlementVertices(g, playerIdx, isSetup) {
    return g.vertices.filter(v => {
        if (v.building) return false;
        const adj = getAdjacentVertices(g, v.key);
        if (adj.some(ak => { const av = g.vertexMap.get(ak); return av && av.building; })) return false;
        if (!isSetup) {
            const adjE = getAdjacentEdges(g, v.key);
            if (!adjE.some(ek => { const e = g.edgeMap.get(ek); return e && e.player === playerIdx; })) return false;
        }
        return true;
    });
}

function validRoadEdges(g, playerIdx, isSetup, lastSettlementKey) {
    return g.edges.filter(e => {
        if (e.player >= 0) return false;
        if (isSetup && lastSettlementKey) {
            return e.v1 === lastSettlementKey || e.v2 === lastSettlementKey;
        }
        const v1 = g.vertexMap.get(e.v1), v2 = g.vertexMap.get(e.v2);
        const canPassV1 = !v1.building || v1.player === playerIdx;
        const canPassV2 = !v2.building || v2.player === playerIdx;
        const roadV1 = getAdjacentEdgesAtVertex(g, e, e.v1).some(ek => { const ae = g.edgeMap.get(ek); return ae && ae.player === playerIdx; });
        const roadV2 = getAdjacentEdgesAtVertex(g, e, e.v2).some(ek => { const ae = g.edgeMap.get(ek); return ae && ae.player === playerIdx; });
        const validV1 = (v1 && v1.player === playerIdx) || (canPassV1 && roadV1);
        const validV2 = (v2 && v2.player === playerIdx) || (canPassV2 && roadV2);
        return validV1 || validV2;
    });
}

function validCityVertices(g, playerIdx) {
    return g.vertices.filter(v => v.building === 'settlement' && v.player === playerIdx);
}

function placeSettlement(g, playerIdx, vertexKey) {
    const v = g.vertexMap.get(vertexKey);
    if (!v) return false;
    v.building = 'settlement';
    v.player = playerIdx;
    g.players[playerIdx].settlements++;
    if (v.port && !g.players[playerIdx].ports.includes(v.port)) {
        g.players[playerIdx].ports.push(v.port);
    }
    if (g.phase === 'setup2') {
        v.hexes.forEach(hid => {
            const hex = g.hexes[hid];
            if (hex.terrain !== 'desert') gain(g.players[playerIdx], hex.terrain);
        });
    }
    return true;
}

function placeRoad(g, playerIdx, edgeKey) {
    const e = g.edgeMap.get(edgeKey);
    if (!e) return false;
    e.player = playerIdx;
    e.road = true;
    g.players[playerIdx].roads++;
    return true;
}

function placeCity(g, playerIdx, vertexKey) {
    const v = g.vertexMap.get(vertexKey);
    if (!v) return false;
    v.building = 'city';
    g.players[playerIdx].settlements--;
    g.players[playerIdx].cities++;
    return true;
}

function distributeResources(g, roll) {
    g.hexes.forEach(hex => {
        if (hex.number !== roll || hex.id === g.robberHex) return;
        hex.vertexKeys.forEach(vk => {
            const v = g.vertexMap.get(vk);
            if (v && v.building) {
                const amt = v.building === 'city' ? 2 : 1;
                gain(g.players[v.player], hex.terrain, amt);
            }
        });
    });
}

function calculateVP(g, playerIdx) {
    const p = g.players[playerIdx];
    let vp = p.settlements + p.cities * 2;
    vp += p.devCards.filter(c => c === 'victoryPoint').length;
    if (p.hasLongestRoad) vp += 2;
    if (p.hasLargestArmy) vp += 2;
    p.victoryPoints = vp;
    return vp;
}

function checkLongestRoad(g) {
    let best = -1, bestLen = 4;
    g.players.forEach((_, idx) => {
        const len = calculateLongestRoadForPlayer(g, idx);
        if (len > bestLen) { bestLen = len; best = idx; }
    });
    g.players.forEach(p => p.hasLongestRoad = false);
    if (best >= 0) { g.players[best].hasLongestRoad = true; g.longestRoadPlayer = best; }
}

function calculateLongestRoadForPlayer(g, playerIdx) {
    const playerEdges = g.edges.filter(e => e.player === playerIdx);
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
        const sv = g.vertexMap.get(start);
        if (sv && sv.building && sv.player !== playerIdx) return;
        const visited = new Set();
        (function dfs(node, length) {
            maxLen = Math.max(maxLen, length);
            (adj[node] || []).forEach(({to, edge}) => {
                if (visited.has(edge)) return;
                const tv = g.vertexMap.get(to);
                if (tv && tv.building && tv.player !== playerIdx) return;
                visited.add(edge);
                dfs(to, length + 1);
                visited.delete(edge);
            });
        })(start, 0);
    });
    return maxLen;
}

function checkLargestArmy(g) {
    let best = -1, bestCount = 2;
    g.players.forEach((p, idx) => { if (p.playedKnights > bestCount) { bestCount = p.playedKnights; best = idx; } });
    g.players.forEach(p => p.hasLargestArmy = false);
    if (best >= 0) { g.players[best].hasLargestArmy = true; g.largestArmyPlayer = best; }
}

function checkWinner(g) {
    for (let i = 0; i < 4; i++) {
        if (calculateVP(g, i) >= 10) { g.winner = i; return i; }
    }
    return -1;
}

function rollDice() {
    return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function addLog(g, msg) {
    g.logs.push(msg);
}

// ============================================================
// GAME STATE SERIALIZATION (per-player view)
// ============================================================

function serializeGameForPlayer(g, playerIdx) {
    // Each player only sees their own resources and dev cards.
    // They see other players' public info (VP, roads, settlements, etc.)
    const state = {
        hexes: g.hexes.map(h => ({ id: h.id, q: h.q, r: h.r, terrain: h.terrain, number: h.number, cx: h.cx, cy: h.cy, corners: h.corners, vertexKeys: h.vertexKeys })),
        vertices: g.vertices.map(v => ({ id: v.id, x: v.x, y: v.y, key: v.key, hexes: v.hexes, building: v.building, player: v.player, port: v.port })),
        edges: g.edges.map(e => ({ id: e.id, v1: e.v1, v2: e.v2, key: e.key, road: e.road, player: e.player })),
        players: g.players.map((p, i) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            resources: i === playerIdx ? { ...p.resources } : null,
            totalCards: totalResources(p),
            devCards: i === playerIdx ? [...p.devCards] : null,
            devCardCount: p.devCards.length,
            playedKnights: p.playedKnights,
            victoryPoints: p.victoryPoints,
            hasLongestRoad: p.hasLongestRoad,
            hasLargestArmy: p.hasLargestArmy,
            roads: p.roads,
            settlements: p.settlements,
            cities: p.cities,
            ports: i === playerIdx ? [...p.ports] : null,
            isCPU: p.isCPU
        })),
        currentPlayer: g.currentPlayer,
        phase: g.phase,
        setupTurn: g.setupTurn,
        setupStep: g.setupStep,
        diceRolled: g.diceRolled,
        robberHex: g.robberHex,
        pendingRobber: g.pendingRobber,
        pendingSteal: g.pendingSteal,
        pendingDiscard: g.pendingDiscard,
        devCardPlayedThisTurn: g.devCardPlayedThisTurn,
        longestRoadPlayer: g.longestRoadPlayer,
        largestArmyPlayer: g.largestArmyPlayer,
        winner: g.winner,
        turnNumber: g.turnNumber,
        devCardsRemaining: g.devCards.length,
        lastSetupSettlement: g.lastSetupSettlement,
        roadBuildingRemaining: g.roadBuildingRemaining,
        mySlot: playerIdx
    };
    return state;
}

function broadcastGameState(lobby) {
    const g = lobby.game;
    lobby.players.forEach(p => {
        const state = serializeGameForPlayer(g, p.slot);
        send(p.ws, { type: 'gameState', state });
    });
}

function broadcastLog(lobby, msg) {
    addLog(lobby.game, msg);
    lobby.players.forEach(p => send(p.ws, { type: 'log', msg }));
}

// ============================================================
// SETUP PHASE (server)
// ============================================================

function getSetupOrder(g) {
    const order1 = [0, 1, 2, 3];
    const order2 = [3, 2, 1, 0];
    return g.phase === 'setup1' ? order1 : order2;
}

function runSetup(lobby) {
    const g = lobby.game;
    g.phase = 'setup1';
    g.setupTurn = 0;
    g.setupStep = 'settlement';
    processSetupTurn(lobby);
}

function processSetupTurn(lobby) {
    const g = lobby.game;
    const order = getSetupOrder(g);

    if (g.setupTurn >= 4) {
        if (g.phase === 'setup1') {
            g.phase = 'setup2';
            g.setupTurn = 0;
            processSetupTurn(lobby);
            return;
        } else {
            g.phase = 'play';
            g.currentPlayer = 0;
            g.turnNumber = 1;
            broadcastLog(lobby, '=== Game Start! ===');
            broadcastLog(lobby, '--- Turn 1 ---');
            broadcastGameState(lobby);
            // If first player is CPU, auto-play
            if (g.players[0].isCPU) {
                setTimeout(() => cpuTurn(lobby), 500);
            }
            return;
        }
    }

    const playerIdx = order[g.setupTurn];
    g.currentPlayer = playerIdx;
    g.setupStep = 'settlement';

    if (g.players[playerIdx].isCPU) {
        cpuSetupPlace(g, playerIdx);
        cpuSetupPlace(g, playerIdx);
        broadcastLog(lobby, `${g.players[playerIdx].name} placed a Settlement and Road`);
        g.setupTurn++;
        broadcastGameState(lobby);
        setTimeout(() => processSetupTurn(lobby), 300);
    } else {
        broadcastGameState(lobby);
    }
}

// ============================================================
// CPU AI (server-side)
// ============================================================

function vertexProduction(g, vertex) {
    let score = 0;
    vertex.hexes.forEach(hid => {
        const hex = g.hexes[hid];
        if (hex.terrain === 'desert') return;
        const n = hex.number;
        score += n <= 7 ? n - 1 : 13 - n;
    });
    return score;
}

function resourceDiversity(g, vertex) {
    const types = new Set();
    vertex.hexes.forEach(hid => {
        const hex = g.hexes[hid];
        if (hex.terrain !== 'desert') types.add(hex.terrain);
    });
    return types.size;
}

function cpuSetupPlace(g, playerIdx) {
    if (g.setupStep === 'settlement') {
        const spots = validSettlementVertices(g, playerIdx, true);
        if (spots.length === 0) return;
        spots.sort((a, b) => (vertexProduction(g, b) + resourceDiversity(g, b) * 2) - (vertexProduction(g, a) + resourceDiversity(g, a) * 2));
        placeSettlement(g, playerIdx, spots[0].key);
        g.lastSetupSettlement = spots[0].key;
        g.setupStep = 'road';
    } else {
        const roads = validRoadEdges(g, playerIdx, true, g.lastSetupSettlement);
        if (roads.length === 0) return;
        placeRoad(g, playerIdx, roads[Math.floor(Math.random() * roads.length)].key);
        g.setupStep = 'settlement';
    }
}

function cpuTurn(lobby) {
    const g = lobby.game;
    const playerIdx = g.currentPlayer;
    const p = g.players[playerIdx];
    if (!p.isCPU) return;

    const roll = rollDice();
    g.diceRolled = true;
    broadcastLog(lobby, `${p.name} rolled ${roll}`);

    if (roll === 7) {
        g.players.forEach((pl, i) => {
            const total = totalResources(pl);
            if (total > 7) cpuDiscard(g, i, Math.floor(total / 2), lobby);
        });
        cpuMoveRobber(g, playerIdx, lobby);
    } else {
        distributeResources(g, roll);
    }

    // Play knight
    if (!g.devCardPlayedThisTurn) {
        const ki = p.devCards.indexOf('knight');
        if (ki >= 0) {
            p.devCards.splice(ki, 1);
            p.playedKnights++;
            checkLargestArmy(g);
            cpuMoveRobber(g, playerIdx, lobby);
            g.devCardPlayedThisTurn = true;
            broadcastLog(lobby, `${p.name} played a Knight`);
        }
    }

    cpuBuild(g, playerIdx, lobby);
    checkLongestRoad(g);

    if (checkWinner(g) >= 0) {
        broadcastLog(lobby, `${g.players[g.winner].name} wins!`);
        broadcastGameState(lobby);
        return;
    }

    // End turn
    g.diceRolled = false;
    g.devCardPlayedThisTurn = false;
    advanceTurn(lobby);
}

function cpuDiscard(g, playerIdx, count, lobby) {
    const p = g.players[playerIdx];
    for (let i = 0; i < count; i++) {
        const available = RESOURCES.filter(r => p.resources[r] > 0);
        if (available.length === 0) break;
        available.sort((a, b) => p.resources[b] - p.resources[a]);
        p.resources[available[0]]--;
    }
    broadcastLog(lobby, `${p.name} discarded ${count} cards`);
}

function cpuMoveRobber(g, playerIdx, lobby) {
    let bestHex = -1, bestScore = -1;
    g.hexes.forEach((hex, i) => {
        if (i === g.robberHex || hex.terrain === 'desert') return;
        let score = 0;
        hex.vertexKeys.forEach(vk => {
            const v = g.vertexMap.get(vk);
            if (v && v.building && v.player !== playerIdx) {
                score += v.building === 'city' ? 3 : 1;
                score += hex.number <= 7 ? hex.number - 1 : 13 - hex.number;
            }
        });
        if (score > bestScore) { bestScore = score; bestHex = i; }
    });
    if (bestHex >= 0) {
        g.robberHex = bestHex;
        const victims = new Set();
        g.hexes[bestHex].vertexKeys.forEach(vk => {
            const v = g.vertexMap.get(vk);
            if (v && v.building && v.player !== playerIdx && totalResources(g.players[v.player]) > 0) victims.add(v.player);
        });
        if (victims.size > 0) {
            const victim = [...victims][Math.floor(Math.random() * victims.size)];
            cpuSteal(g, playerIdx, victim, lobby);
        }
    }
}

function cpuSteal(g, thiefIdx, victimIdx, lobby) {
    const victim = g.players[victimIdx];
    const available = RESOURCES.filter(r => victim.resources[r] > 0);
    if (available.length === 0) return;
    const res = available[Math.floor(Math.random() * available.length)];
    victim.resources[res]--;
    g.players[thiefIdx].resources[res]++;
    broadcastLog(lobby, `${g.players[thiefIdx].name} stole from ${g.players[victimIdx].name}`);
}

function cpuBuild(g, playerIdx, lobby) {
    const p = g.players[playerIdx];
    for (let attempt = 0; attempt < 10; attempt++) {
        let built = false;
        if (canAfford(p, COSTS.city)) {
            const spots = validCityVertices(g, playerIdx);
            if (spots.length > 0) {
                spots.sort((a, b) => vertexProduction(g, b) - vertexProduction(g, a));
                spend(p, COSTS.city);
                placeCity(g, playerIdx, spots[0].key);
                broadcastLog(lobby, `${p.name} built a City`);
                built = true; continue;
            }
        }
        if (canAfford(p, COSTS.settlement)) {
            const spots = validSettlementVertices(g, playerIdx, false);
            if (spots.length > 0) {
                spots.sort((a, b) => vertexProduction(g, b) - vertexProduction(g, a));
                spend(p, COSTS.settlement);
                placeSettlement(g, playerIdx, spots[0].key);
                broadcastLog(lobby, `${p.name} built a Settlement`);
                built = true; continue;
            }
        }
        if (canAfford(p, COSTS.devCard) && g.devCards.length > 0 && p.devCards.length < 5) {
            spend(p, COSTS.devCard);
            p.devCards.push(g.devCards.pop());
            broadcastLog(lobby, `${p.name} bought a Development Card`);
            built = true; continue;
        }
        if (canAfford(p, COSTS.road) && p.roads < 15) {
            const spots = validRoadEdges(g, playerIdx, false, null);
            if (spots.length > 0) {
                spend(p, COSTS.road);
                placeRoad(g, playerIdx, spots[Math.floor(Math.random() * spots.length)].key);
                broadcastLog(lobby, `${p.name} built a Road`);
                built = true; continue;
            }
        }
        // Trade
        const needed = findNeededResource(g, playerIdx);
        if (needed) {
            const excess = RESOURCES.filter(r => r !== needed && p.resources[r] >= getTradeRatio(p, r));
            if (excess.length > 0) {
                excess.sort((a, b) => p.resources[b] - p.resources[a]);
                const giveRes = excess[0], ratio = getTradeRatio(p, giveRes);
                p.resources[giveRes] -= ratio;
                p.resources[needed]++;
                broadcastLog(lobby, `${p.name} traded ${ratio} ${giveRes} for 1 ${needed}`);
                continue;
            }
        }
        if (!built) break;
    }
}

function findNeededResource(g, playerIdx) {
    const p = g.players[playerIdx];
    const needs = {};
    RESOURCES.forEach(r => needs[r] = 0);
    Object.entries(COSTS.settlement).forEach(([r, amt]) => { if (p.resources[r] < amt) needs[r] += amt - p.resources[r]; });
    Object.entries(COSTS.city).forEach(([r, amt]) => { if (p.resources[r] < amt) needs[r] += (amt - p.resources[r]) * 0.5; });
    const sorted = RESOURCES.filter(r => needs[r] > 0).sort((a, b) => needs[b] - needs[a]);
    return sorted.length > 0 ? sorted[0] : null;
}

// ============================================================
// TURN MANAGEMENT
// ============================================================

function advanceTurn(lobby) {
    const g = lobby.game;
    g.currentPlayer = (g.currentPlayer + 1) % 4;
    if (g.currentPlayer === 0) {
        g.turnNumber++;
        broadcastLog(lobby, `--- Turn ${g.turnNumber} ---`);
    }
    g.diceRolled = false;
    g.devCardPlayedThisTurn = false;
    g.roadBuildingRemaining = 0;
    broadcastGameState(lobby);

    if (g.players[g.currentPlayer].isCPU) {
        setTimeout(() => cpuTurn(lobby), 500);
    }
}

// ============================================================
// MESSAGE HANDLING
// ============================================================

function handleMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
        case 'createLobby': {
            const name = String(msg.name || 'Player').slice(0, 20);
            const lobby = createLobby(ws, name);
            ws._lobbyId = lobby.id;
            ws._slot = 0;
            ws._name = name;
            send(ws, { type: 'lobbyCreated', lobbyId: lobby.id });
            broadcastLobby(lobby);
            break;
        }
        case 'joinLobby': {
            const lobby = lobbies.get(String(msg.lobbyId));
            if (!lobby) { send(ws, { type: 'error', msg: 'Lobby not found' }); return; }
            if (lobby.started) { send(ws, { type: 'error', msg: 'Game already started' }); return; }
            if (lobby.players.length >= 4) { send(ws, { type: 'error', msg: 'Lobby full' }); return; }
            const name = String(msg.name || 'Player').slice(0, 20);
            // Find first available CPU slot
            const slot = [...lobby.cpuSlots].sort()[0];
            if (slot === undefined) { send(ws, { type: 'error', msg: 'No slots' }); return; }
            lobby.cpuSlots.delete(slot);
            lobby.players.push({ ws, name, slot });
            ws._lobbyId = lobby.id;
            ws._slot = slot;
            ws._name = name;
            send(ws, { type: 'lobbyJoined', lobbyId: lobby.id, slot });
            broadcastLobby(lobby);
            break;
        }
        case 'startGame': {
            const lobby = lobbies.get(ws._lobbyId);
            if (!lobby || lobby.started) return;
            // Only host (slot 0) can start
            if (ws._slot !== 0) return;
            lobby.started = true;
            initServerGame(lobby);
            broadcastLog(lobby, 'Game started! Place your settlements.');
            broadcastGameState(lobby);
            setTimeout(() => runSetup(lobby), 300);
            break;
        }
        case 'action': {
            const lobby = lobbies.get(ws._lobbyId);
            if (!lobby || !lobby.game) return;
            handleAction(lobby, ws._slot, msg);
            break;
        }
        case 'listLobbies': {
            const list = [];
            lobbies.forEach((lobby, id) => {
                if (!lobby.started) {
                    list.push({ id, playerCount: lobby.players.length, cpuCount: lobby.cpuSlots.size });
                }
            });
            send(ws, { type: 'lobbyList', lobbies: list });
            break;
        }
    }
}

function handleAction(lobby, playerSlot, msg) {
    const g = lobby.game;
    if (g.winner >= 0) return;
    if (g.currentPlayer !== playerSlot) return;
    if (g.players[playerSlot].isCPU) return;

    const p = g.players[playerSlot];
    const action = msg.action;

    // SETUP ACTIONS
    if (g.phase === 'setup1' || g.phase === 'setup2') {
        if (action === 'placeSettlement' && g.setupStep === 'settlement') {
            const valid = validSettlementVertices(g, playerSlot, true);
            const target = valid.find(v => v.key === msg.vertexKey);
            if (!target) return;
            placeSettlement(g, playerSlot, target.key);
            g.lastSetupSettlement = target.key;
            g.setupStep = 'road';
            broadcastLog(lobby, `${p.name} placed a Settlement`);
            broadcastGameState(lobby);
        } else if (action === 'placeRoad' && g.setupStep === 'road') {
            const valid = validRoadEdges(g, playerSlot, true, g.lastSetupSettlement);
            const target = valid.find(e => e.key === msg.edgeKey);
            if (!target) return;
            placeRoad(g, playerSlot, target.key);
            g.setupStep = 'settlement';
            broadcastLog(lobby, `${p.name} placed a Road`);
            g.setupTurn++;
            broadcastGameState(lobby);
            setTimeout(() => processSetupTurn(lobby), 300);
        }
        return;
    }

    // PLAY ACTIONS
    if (action === 'rollDice' && !g.diceRolled) {
        const roll = rollDice();
        g.diceRolled = true;
        broadcastLog(lobby, `${p.name} rolled ${roll}`);
        lobby.players.forEach(lp => send(lp.ws, { type: 'diceResult', roll }));

        if (roll === 7) {
            // Check discards
            const discardNeeded = [];
            g.players.forEach((pl, i) => {
                const total = totalResources(pl);
                if (total > 7) {
                    if (pl.isCPU) {
                        cpuDiscard(g, i, Math.floor(total / 2), lobby);
                    } else {
                        discardNeeded.push({ slot: i, count: Math.floor(total / 2) });
                    }
                }
            });
            if (discardNeeded.length > 0) {
                g.discardQueue = discardNeeded;
                g.pendingDiscard = true;
                // Notify players who need to discard
                discardNeeded.forEach(d => {
                    const lp = lobby.players.find(p => p.slot === d.slot);
                    if (lp) send(lp.ws, { type: 'mustDiscard', count: d.count });
                });
                broadcastGameState(lobby);
            } else {
                g.pendingRobber = true;
                broadcastGameState(lobby);
            }
        } else {
            distributeResources(g, roll);
            broadcastGameState(lobby);
        }
    } else if (action === 'discard' && g.pendingDiscard) {
        const entry = g.discardQueue.find(d => d.slot === playerSlot);
        if (!entry) return;
        const discards = msg.discards; // { wood: 1, brick: 2, ... }
        let total = 0;
        for (const r of RESOURCES) {
            const amt = discards[r] || 0;
            if (amt < 0 || amt > p.resources[r]) return;
            total += amt;
        }
        if (total !== entry.count) return;
        for (const r of RESOURCES) p.resources[r] -= (discards[r] || 0);
        g.discardQueue = g.discardQueue.filter(d => d.slot !== playerSlot);
        broadcastLog(lobby, `${p.name} discarded ${total} cards`);
        if (g.discardQueue.length === 0) {
            g.pendingDiscard = false;
            g.pendingRobber = true;
        }
        broadcastGameState(lobby);
    } else if (action === 'moveRobber' && g.pendingRobber) {
        const hexIdx = msg.hexIdx;
        if (hexIdx < 0 || hexIdx >= g.hexes.length || hexIdx === g.robberHex) return;
        g.robberHex = hexIdx;
        g.pendingRobber = false;
        // Find steal candidates
        const victims = new Set();
        g.hexes[hexIdx].vertexKeys.forEach(vk => {
            const v = g.vertexMap.get(vk);
            if (v && v.building && v.player !== playerSlot && totalResources(g.players[v.player]) > 0) victims.add(v.player);
        });
        if (victims.size === 0) {
            broadcastGameState(lobby);
        } else if (victims.size === 1) {
            const victim = [...victims][0];
            stealRandom(g, playerSlot, victim, lobby);
            broadcastGameState(lobby);
        } else {
            g.pendingSteal = true;
            send(lobby.players.find(lp => lp.slot === playerSlot)?.ws, { type: 'chooseSteal', victims: [...victims] });
            broadcastGameState(lobby);
        }
    } else if (action === 'steal' && g.pendingSteal) {
        const victimIdx = msg.victim;
        if (victimIdx < 0 || victimIdx >= 4 || victimIdx === playerSlot) return;
        stealRandom(g, playerSlot, victimIdx, lobby);
        g.pendingSteal = false;
        broadcastGameState(lobby);
    } else if (action === 'buildSettlement' && g.diceRolled && !g.pendingRobber && !g.pendingSteal) {
        if (!canAfford(p, COSTS.settlement)) return;
        const valid = validSettlementVertices(g, playerSlot, false);
        const target = valid.find(v => v.key === msg.vertexKey);
        if (!target) return;
        spend(p, COSTS.settlement);
        placeSettlement(g, playerSlot, target.key);
        checkLongestRoad(g);
        broadcastLog(lobby, `${p.name} built a Settlement`);
        checkAndBroadcastWinner(lobby);
    } else if (action === 'buildRoad' && g.diceRolled && !g.pendingRobber && !g.pendingSteal) {
        if (!g.roadBuildingRemaining && !canAfford(p, COSTS.road)) return;
        const valid = validRoadEdges(g, playerSlot, false, null);
        const target = valid.find(e => e.key === msg.edgeKey);
        if (!target) return;
        if (!g.roadBuildingRemaining) spend(p, COSTS.road);
        placeRoad(g, playerSlot, target.key);
        if (g.roadBuildingRemaining > 0) {
            g.roadBuildingRemaining--;
            broadcastLog(lobby, `${p.name} placed a Road (Road Building)`);
        } else {
            broadcastLog(lobby, `${p.name} built a Road`);
        }
        checkLongestRoad(g);
        checkAndBroadcastWinner(lobby);
    } else if (action === 'buildCity' && g.diceRolled && !g.pendingRobber && !g.pendingSteal) {
        if (!canAfford(p, COSTS.city)) return;
        const valid = validCityVertices(g, playerSlot);
        const target = valid.find(v => v.key === msg.vertexKey);
        if (!target) return;
        spend(p, COSTS.city);
        placeCity(g, playerSlot, target.key);
        broadcastLog(lobby, `${p.name} built a City`);
        checkAndBroadcastWinner(lobby);
    } else if (action === 'buyDevCard' && g.diceRolled && !g.pendingRobber && !g.pendingSteal) {
        if (!canAfford(p, COSTS.devCard) || g.devCards.length === 0) return;
        spend(p, COSTS.devCard);
        const card = g.devCards.pop();
        p.devCards.push(card);
        broadcastLog(lobby, `${p.name} bought a Development Card`);
        // Tell only this player what card they got
        const lp = lobby.players.find(lp => lp.slot === playerSlot);
        if (lp) send(lp.ws, { type: 'devCardDrawn', card });
        checkAndBroadcastWinner(lobby);
    } else if (action === 'playDevCard' && g.diceRolled && !g.devCardPlayedThisTurn) {
        const cardType = msg.cardType;
        const idx = p.devCards.indexOf(cardType);
        if (idx < 0 || cardType === 'victoryPoint') return;
        p.devCards.splice(idx, 1);
        g.devCardPlayedThisTurn = true;

        if (cardType === 'knight') {
            p.playedKnights++;
            checkLargestArmy(g);
            g.pendingRobber = true;
            broadcastLog(lobby, `${p.name} played a Knight`);
        } else if (cardType === 'roadBuilding') {
            g.roadBuildingRemaining = 2;
            broadcastLog(lobby, `${p.name} played Road Building`);
        } else if (cardType === 'yearOfPlenty') {
            const r1 = msg.resource1, r2 = msg.resource2;
            if (RESOURCES.includes(r1)) gain(p, r1);
            if (RESOURCES.includes(r2)) gain(p, r2);
            broadcastLog(lobby, `${p.name} played Year of Plenty`);
        } else if (cardType === 'monopoly') {
            const res = msg.resource;
            if (RESOURCES.includes(res)) {
                let total = 0;
                g.players.forEach((pl, i) => {
                    if (i !== playerSlot) { total += pl.resources[res]; pl.resources[res] = 0; }
                });
                p.resources[res] += total;
                broadcastLog(lobby, `${p.name} played Monopoly on ${res}, got ${total}`);
            }
        }
        checkAndBroadcastWinner(lobby);
    } else if (action === 'trade' && g.diceRolled && !g.pendingRobber) {
        const giveRes = msg.give, getRes = msg.get;
        if (!RESOURCES.includes(giveRes) || !RESOURCES.includes(getRes) || giveRes === getRes) return;
        const ratio = getTradeRatio(p, giveRes);
        if (p.resources[giveRes] < ratio) return;
        p.resources[giveRes] -= ratio;
        p.resources[getRes]++;
        broadcastLog(lobby, `${p.name} traded ${ratio} ${giveRes} for 1 ${getRes}`);
        broadcastGameState(lobby);
    } else if (action === 'endTurn' && g.diceRolled && !g.pendingRobber && !g.pendingSteal && !g.pendingDiscard) {
        if (g.roadBuildingRemaining > 0) return; // Must place roads first
        advanceTurn(lobby);
    }
}

function stealRandom(g, thiefIdx, victimIdx, lobby) {
    const victim = g.players[victimIdx];
    const available = RESOURCES.filter(r => victim.resources[r] > 0);
    if (available.length === 0) return;
    const res = available[Math.floor(Math.random() * available.length)];
    victim.resources[res]--;
    g.players[thiefIdx].resources[res]++;
    broadcastLog(lobby, `${g.players[thiefIdx].name} stole from ${g.players[victimIdx].name}`);
}

function checkAndBroadcastWinner(lobby) {
    const g = lobby.game;
    if (checkWinner(g) >= 0) {
        broadcastLog(lobby, `${g.players[g.winner].name} wins!`);
    }
    broadcastGameState(lobby);
}

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================

wss.on('connection', ws => {
    ws.on('message', data => handleMessage(ws, data.toString()));
    ws.on('close', () => {
        if (ws._lobbyId) {
            const lobby = lobbies.get(ws._lobbyId);
            if (lobby) {
                lobby.players = lobby.players.filter(p => p.ws !== ws);
                if (lobby.players.length === 0) {
                    lobbies.delete(ws._lobbyId);
                } else if (lobby.started && lobby.game) {
                    // Convert disconnected player to CPU
                    lobby.game.players[ws._slot].isCPU = true;
                    lobby.game.players[ws._slot].name += ' (DC)';
                    lobby.cpuSlots.add(ws._slot);
                    broadcastLog(lobby, `${lobby.game.players[ws._slot].name} disconnected`);
                    // If it's their turn, CPU takes over
                    if (lobby.game.currentPlayer === ws._slot && lobby.game.phase === 'play') {
                        setTimeout(() => cpuTurn(lobby), 500);
                    } else if ((lobby.game.phase === 'setup1' || lobby.game.phase === 'setup2') && lobby.game.currentPlayer === ws._slot) {
                        cpuSetupPlace(lobby.game, ws._slot);
                        cpuSetupPlace(lobby.game, ws._slot);
                        lobby.game.setupTurn++;
                        broadcastGameState(lobby);
                        setTimeout(() => processSetupTurn(lobby), 300);
                    }
                    broadcastGameState(lobby);
                } else {
                    broadcastLobby(lobby);
                }
            }
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Catan server running at http://localhost:${PORT}`);
});
