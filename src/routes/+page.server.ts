import { redirect, type Actions } from "@sveltejs/kit";
import makeFetchCookie from "fetch-cookie";
import type { PageServerLoad } from "./$types";

interface GamePlayer { username: string, rank: number; }
interface Game { players: GamePlayer[], finished: boolean; startTime: number; }

export interface Player {
    username: string;
    points: number;
    ranks: [number, number, number];
    rank: number;
    winStreak: number;
    lossStreak: number;
    winPercent: number;
    longestWinStreak: number;
    longestLossStreak: number;
}
export interface Leaderboard { games: number, players: Player[]; }

export const load: PageServerLoad<{ leaderboard: Leaderboard | null; usernames: string; }> = async ({ url }) => {
    const usernames = url.searchParams.get("usernames") ?? "";
    const limit = parseInt(url.searchParams.get("limit") ?? "");
    const exact = (url.searchParams.get("exact") ?? "true") === "true";

    const playerUsernames = new Set(usernames.split(",").map(name => name.trim()).filter(Boolean));

    if (playerUsernames.size === 0) return { leaderboard: null, usernames, exact };

    const fetchCookie = makeFetchCookie(fetch);

    await fetchCookie("https://colonist.io");
    const res = await fetchCookie(`https://colonist.io/api/profile/${playerUsernames.values().next().value}/history`);

    if (!res.ok) return { leaderboard: { games: 0, players: [] }, usernames, exact };

    const rawData: Game[] = await res.json();

    const allData = rawData.filter((game) => {
        if (!game.finished) return false;

        const set = new Set();

        for (const player of game.players) {
            set.add(player.username);

            if (exact && !playerUsernames.has(player.username)) {
                return false;
            }
        }

        for (const player of playerUsernames) {
            if (!set.has(player)) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => a.startTime - b.startTime);

    const data = allData.slice(Math.max((isNaN(limit) || limit < 0) ? 0 : allData.length - limit, 0));

    const players: Record<string, Player> = {};

    for (const game of data) {
        for (const player of game.players) {
            if (!players[player.username]) {
                players[player.username] = {
                    points: 0,
                    ranks: [0, 0, 0],
                    username: player.username,
                    rank: 0,
                    winStreak: 0,
                    lossStreak: 0,
                    winPercent: 0,
                    longestWinStreak: 0,
                    longestLossStreak: 0,
                };
            }

            if (player.rank === 1) {
                players[player.username].lossStreak = 0;
                players[player.username].winStreak++;
                players[player.username].longestWinStreak = Math.max(players[player.username].longestWinStreak, players[player.username].winStreak);
            } else {
                players[player.username].winStreak = 0;
                players[player.username].lossStreak++;
                players[player.username].longestLossStreak = Math.max(players[player.username].longestLossStreak, players[player.username].lossStreak);
            }

            players[player.username].points += Math.max(4 - player.rank, 0);
            players[player.username].ranks[player.rank - 1]++;
        }
    }

    const playerList = [...Object.values(players)].sort((a, b) => b.points - a.points);

    for (let i = 0; i < playerList.length; i++) {
        playerList[i].rank = i;
        playerList[i].winPercent = data.length === 0 ? 0 : playerList[i].ranks[0] / data.length;
    }

    return { leaderboard: { games: data.length, players: playerList }, usernames, exact };
};

export const actions: Actions = {
    default: async ({ request }) => {
        const data = await request.formData();
        const usernames = data.get("usernames");
        const exact = data.get("exact");

        const params = new URLSearchParams({
            ...(usernames && { usernames: String(usernames) }),
            ...(!exact && { exact: String(exact) })
        }).toString();

        throw redirect(303, params ? `/?${params}` : '/');
    }
};