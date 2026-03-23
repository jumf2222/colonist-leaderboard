export interface GamePlayer {
	username: string;
	rank: number;
	points: number;
}

export interface Game {
	players: GamePlayer[];
	finished: boolean;
	startTime: number;
	duration: string;
	turnCount: number;
}

export interface PlayerGame {
	date: number;
	duration: number;
	turnCount: number;
	rank: number;
	vp: number;
	players: { username: string; rank: number; vp: number }[];
}

export interface MatchHistoryGame {
	date: number;
	duration: number;
	turnCount: number;
	players: { username: string; rank: number; vp: number }[];
}

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
	avgDuration: number;
	avgTurns: number;
	avgVP: number;
	gamesPlayed: number;
	games: PlayerGame[];
}

export interface Leaderboard {
	games: number;
	players: Player[];
	avgDuration: number;
	matchHistory: MatchHistoryGame[];
}
