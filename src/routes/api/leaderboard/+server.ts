import { json, type RequestHandler } from '@sveltejs/kit';
import makeFetchCookie from "fetch-cookie";

interface GamePlayer { username: string, rank: number; }
interface Game { players: GamePlayer[], finished: boolean; }

export interface Player { username: string, points: number, ranks: [number, number, number]; rank: number; }
export interface Leaderboard { games: number, players: Player[]; }

export const GET: RequestHandler = async ({ request, url }) => {
    const playerUsernames = new Set((url.searchParams.get("usernames") ?? "").split(",").map(name => name.trim()).filter(Boolean));

    if (playerUsernames.size === 0) return json({ games: 0, players: [] });

    const fetchCookie = makeFetchCookie(fetch);

    await fetchCookie("https://colonist.io");
    const res = await fetchCookie(`https://colonist.io/api/profile/${playerUsernames.values().next().value}/history`);

    if (!res.ok) return json({ games: 0, players: [] });

    const rawData: Game[] = await res.json();

    const data = rawData.filter((game) => {
        if (!game.finished) return false;

        const set = new Set();

        for (const player of game.players) {
            set.add(player.username);

            if (!playerUsernames.has(player.username)) {
                return false;
            }
        }

        for (const player of playerUsernames) {
            if (!set.has(player)) {
                return false;
            }
        }

        return true;
    });

    const players: Record<string, Player> = {};

    for (const game of data) {
        for (const player of game.players) {
            if (!players[player.username]) {
                players[player.username] = { points: 0, ranks: [0, 0, 0], username: player.username, rank: 0 };
            }

            players[player.username].points += Math.max(4 - player.rank, 0);
            players[player.username].ranks[player.rank - 1] += 1;
        }
    }

    const playerList = [...Object.values(players)].sort((a, b) => b.points - a.points);

    for (let i = 0; i < playerList.length; i++) {
        playerList[i].rank = i;
    }

    return json({ games: data.length, players: playerList });
}

