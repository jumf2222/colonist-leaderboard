import { createSignal, For, Show } from 'solid-js';
import type { MatchHistoryGame } from '~/lib/types';
import { formatDuration } from '~/lib/format';

function formatDate(ms: number): string {
	const d = new Date(ms);
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullDate(ms: number): string {
	const d = new Date(ms);
	return d.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

function ordinal(rank: number): string {
	if (rank === 1) return '1st';
	if (rank === 2) return '2nd';
	if (rank === 3) return '3rd';
	return `${rank}th`;
}

export default function MatchHistory(props: {
	games: MatchHistoryGame[];
	hoveredPlayer: string | null;
	totalGames: number;
	avgDuration: number;
}) {
	const [selectedGame, setSelectedGame] = createSignal<MatchHistoryGame | null>(null);

	return (
		<>
			<div class="match-history">
				<div class="mh-header">
					<h3 class="mh-title">Match History</h3>
					<div class="mh-stats">
						<span>{props.totalGames} games</span>
						{props.avgDuration > 0 && (
							<>
								<span>&middot;</span>
								<span>{formatDuration(props.avgDuration)} avg</span>
							</>
						)}
					</div>
				</div>
				<div class="mh-list">
					<For each={props.games}>
						{(game) => {
							const winner = () => game.players.find((p) => p.rank === 1);
							const isHighlighted = () =>
								props.hoveredPlayer !== null &&
								game.players.some(
									(p) => p.username === props.hoveredPlayer && p.rank === 1
								);
							const isInvolved = () =>
								props.hoveredPlayer !== null &&
								game.players.some((p) => p.username === props.hoveredPlayer);
							const isDimmed = () =>
								props.hoveredPlayer !== null && !isInvolved();

							return (
								<button
									class="mh-row"
									classList={{
										'mh-highlighted': isHighlighted(),
										'mh-dimmed': isDimmed()
									}}
									onClick={() => setSelectedGame(game)}
								>
									<span class="mh-date">{formatDate(game.date)}</span>
									<span class="mh-winner">{winner()?.username ?? '—'}</span>
									<span class="mh-detail">
										{formatDuration(game.duration)}
									</span>
								</button>
							);
						}}
					</For>
				</div>
			</div>

			<Show when={selectedGame()}>
				{(game) => (
					<div class="dialog-overlay" onClick={() => setSelectedGame(null)}>
						<div class="match-dialog" onClick={(e) => e.stopPropagation()}>
							<div class="match-dialog-header">
								<h3>Match Details</h3>
								<button class="match-dialog-close" onClick={() => setSelectedGame(null)}>
									&times;
								</button>
							</div>
							<div class="match-dialog-meta">
								<div class="match-dialog-stat">
									<span class="match-dialog-label">Date</span>
									<span>{formatFullDate(game().date)}</span>
								</div>
								<div class="match-dialog-stat">
									<span class="match-dialog-label">Duration</span>
									<span>{formatDuration(game().duration)}</span>
								</div>
								<div class="match-dialog-stat">
									<span class="match-dialog-label">Turns</span>
									<span>{game().turnCount}</span>
								</div>
							</div>
							<div class="match-dialog-players">
								<div class="match-dialog-player-header">
									<span class="mdp-place">Place</span>
									<span class="mdp-name">Player</span>
									<span class="mdp-vp">VP</span>
								</div>
								<For each={[...game().players].sort((a, b) => a.rank - b.rank)}>
									{(player) => (
										<div
											class="match-dialog-player-row"
											classList={{ 'match-dialog-winner': player.rank === 1 }}
										>
											<span class="mdp-place">
												<span
													classList={{
														'win chip': player.rank === 1,
														'loss chip': player.rank !== 1
													}}
												>
													{ordinal(player.rank)}
												</span>
											</span>
											<span class="mdp-name">{player.username}</span>
											<span class="mdp-vp">{player.vp}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>
				)}
			</Show>
		</>
	);
}
