import { query } from '@solidjs/router';
import type { Game, Leaderboard, Player } from './types';

export const getLeaderboard = query(
	async (usernamesStr: string, exact: boolean, limitStr: string): Promise<Leaderboard | null> => {
		'use server';

		const playerUsernames = new Set(
			usernamesStr
				.split(',')
				.map((name) => name.trim())
				.filter(Boolean)
		);

		if (playerUsernames.size === 0) return null;

		const makeFetchCookie = (await import('fetch-cookie')).default;
		const fetchCookie = makeFetchCookie(fetch);

		await fetchCookie('https://colonist.io');
		const res = await fetchCookie(
			`https://colonist.io/api/profile/${[...playerUsernames][0]}/history`
		);

		if (!res.ok) return { games: 0, players: [], avgDuration: 0 };

		const rawData: Game[] = await res.json();

		const allData = rawData.gameDatas
			.filter((game) => {
				if (!game.finished) return false;

				const set = new Set<string>();

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
			})
			.sort((a, b) => a.startTime - b.startTime);

		const limit = parseInt(limitStr);
		const data = allData.slice(Math.max(isNaN(limit) || limit < 0 ? 0 : allData.length - limit, 0));

		const players: Record<string, Player> = {};
		const playerDurations: Record<string, number[]> = {};
		const playerTurns: Record<string, number[]> = {};
		const playerVPs: Record<string, number[]> = {};

		for (const game of data) {
			const duration = parseInt(game.duration);
			const turns = game.turnCount;

			const gamePlayers = game.players.map((p) => ({
				username: p.username,
				rank: p.rank,
				vp: p.points
			}));

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
						avgDuration: 0,
						avgTurns: 0,
						avgVP: 0,
						gamesPlayed: 0,
						games: []
					};
					playerDurations[player.username] = [];
					playerTurns[player.username] = [];
					playerVPs[player.username] = [];
				}

				players[player.username].gamesPlayed++;
				players[player.username].games.push({
					date: typeof game.startTime === 'string' ? parseInt(game.startTime) : game.startTime,
					duration: isNaN(duration) ? 0 : duration,
					turnCount: turns,
					rank: player.rank,
					vp: player.points,
					players: gamePlayers
				});
				if (!isNaN(duration)) playerDurations[player.username].push(duration);
				playerTurns[player.username].push(turns);
				playerVPs[player.username].push(player.points);

				if (player.rank === 1) {
					players[player.username].lossStreak = 0;
					players[player.username].winStreak++;
					players[player.username].longestWinStreak = Math.max(
						players[player.username].longestWinStreak,
						players[player.username].winStreak
					);
				} else {
					players[player.username].winStreak = 0;
					players[player.username].lossStreak++;
					players[player.username].longestLossStreak = Math.max(
						players[player.username].longestLossStreak,
						players[player.username].lossStreak
					);
				}

				players[player.username].points += Math.max(4 - player.rank, 0);
				players[player.username].ranks[player.rank - 1]++;
			}
		}

		const playerList = [...Object.values(players)].sort((a, b) => b.points - a.points);

		let totalDuration = 0;
		let durationCount = 0;

		for (let i = 0; i < playerList.length; i++) {
			const p = playerList[i];
			p.rank = i;
			p.winPercent = data.length === 0 ? 0 : p.ranks[0] / data.length;

			const durations = playerDurations[p.username];
			const turns = playerTurns[p.username];
			const vps = playerVPs[p.username];

			p.avgDuration = durations.length > 0
				? durations.reduce((a, b) => a + b, 0) / durations.length
				: 0;
			p.avgTurns = turns.length > 0
				? turns.reduce((a, b) => a + b, 0) / turns.length
				: 0;
			p.avgVP = vps.length > 0
				? vps.reduce((a, b) => a + b, 0) / vps.length
				: 0;

			totalDuration += durations.reduce((a, b) => a + b, 0);
			durationCount += durations.length;
		}

		const avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;

		const matchHistory = [...data].reverse().map((game) => {
			const duration = parseInt(game.duration);
			return {
				date: typeof game.startTime === 'string' ? parseInt(game.startTime) : game.startTime,
				duration: isNaN(duration) ? 0 : duration,
				turnCount: game.turnCount,
				players: game.players.map((p) => ({
					username: p.username,
					rank: p.rank,
					vp: p.points
				}))
			};
		});


		return { games: data.length, players: playerList, avgDuration, matchHistory };
	},
	'leaderboard'
);
