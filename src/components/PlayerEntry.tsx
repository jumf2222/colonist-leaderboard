import { createSignal, For, Show } from 'solid-js';
import type { Player } from '~/lib/types';
import { formatDuration } from '~/lib/format';
import goldSvg from '~/lib/assets/gold.svg?raw';
import silverSvg from '~/lib/assets/silver.svg?raw';
import bronzeSvg from '~/lib/assets/bronze.svg?raw';

function formatDate(ms: number): string {
	const d = new Date(ms);
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ordinal(rank: number): string {
	if (rank === 1) return '1st';
	if (rank === 2) return '2nd';
	if (rank === 3) return '3rd';
	return `${rank}th`;
}

export default function PlayerEntry(props: {
	player: Player;
	onHover: (username: string | null) => void;
}) {
	const [expanded, setExpanded] = createSignal(false);

	const toggle = (e: MouseEvent) => {
		e.preventDefault();
		setExpanded((v) => !v);
	};

	const sortedGames = () => [...props.player.games].reverse();

	return (
		<div
			class="player-card"
			onMouseEnter={() => props.onHover(props.player.username)}
			onMouseLeave={() => props.onHover(null)}
		>
			<a
				class="player-wrapper"
				href={`https://colonist.io/profile/${props.player.username}`}
				target="_blank"
			>
				<div class="row gap m-column center">
					<div class="row gap center">
						<h2 classList={{ first: props.player.rank === 0 }}>{props.player.rank + 1}</h2>
						<div class="player name">
							<h3>{props.player.username}</h3>
							<p>{props.player.points} Points</p>
						</div>
					</div>
					<div class="row gap center">
						<div class="player center">
							<h4>Streak</h4>
							<div>
								<p
									class={
										props.player.winStreak >= props.player.lossStreak
											? 'win chip'
											: 'loss chip'
									}
								>
									{props.player.winStreak >= props.player.lossStreak
										? `${props.player.winStreak} W`
										: `${props.player.lossStreak} L`}
								</p>
							</div>
						</div>
						<div class="player center">
							<h4>Longest Streak</h4>
							<div>
								<p class="chip">{props.player.longestWinStreak} W</p>
								<p class="chip">{props.player.longestLossStreak} L</p>
							</div>
						</div>
						<div class="player center">
							<h4>Win %</h4>
							<p class="chip clear">{Math.round(props.player.winPercent * 100)}%</p>
						</div>
					</div>
				</div>

				<div class="row gap center stats-row">
					<div class="player center">
						<h4>Avg Duration</h4>
						<p class="chip clear">{formatDuration(props.player.avgDuration)}</p>
					</div>
					<div class="player center">
						<h4>Avg Turns</h4>
						<p class="chip clear">{Math.round(props.player.avgTurns)}</p>
					</div>
					<div class="player center">
						<h4>Avg VP</h4>
						<p class="chip clear">{props.player.avgVP.toFixed(1)}</p>
					</div>
				</div>

				<div class="row medal-wrapper center">
					<div class="row medals center">
						<span innerHTML={goldSvg} />
						<p>{props.player.ranks[0]}</p>
					</div>
					<div class="row medals center">
						<span innerHTML={silverSvg} />
						<p>{props.player.ranks[1]}</p>
					</div>
					<div class="row medals center">
						<span innerHTML={bronzeSvg} />
						<p>{props.player.ranks[2]}</p>
					</div>
				</div>
			</a>

			<button class="expand-btn" onClick={toggle}>
				<svg
					class="expand-icon"
					classList={{ 'expand-icon-open': expanded() }}
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
				>
					<path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				{expanded() ? 'Hide' : 'Show'} Games ({props.player.gamesPlayed})
			</button>

			<Show when={expanded()}>
				<div class="games-list">
					<div class="game-row game-header">
						<span class="game-col game-date">Date</span>
						<span class="game-col game-place">Place</span>
						<span class="game-col game-vp">VP</span>
						<span class="game-col game-turns">Turns</span>
						<span class="game-col game-dur">Duration</span>
						<span class="game-col game-players">Players</span>
					</div>
					<For each={sortedGames()}>
						{(game) => (
							<div class="game-row" classList={{ 'game-win': game.rank === 1 }}>
								<span class="game-col game-date">{formatDate(game.date)}</span>
								<span class="game-col game-place">
									<span
										classList={{
											'win chip': game.rank === 1,
											'loss chip': game.rank !== 1
										}}
									>
										{ordinal(game.rank)}
									</span>
								</span>
								<span class="game-col game-vp">{game.vp}</span>
								<span class="game-col game-turns">{game.turnCount}</span>
								<span class="game-col game-dur">{formatDuration(game.duration)}</span>
								<span class="game-col game-players">
									{game.players
										.sort((a, b) => a.rank - b.rank)
										.map((p) => p.username)
										.join(', ')}
								</span>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}
