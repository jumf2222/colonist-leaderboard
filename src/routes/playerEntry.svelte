<script lang="ts">
	import Gold from '$lib/assets/gold.svg?component';
	import Silver from '$lib/assets/silver.svg?component';
	import Bronze from '$lib/assets/bronze.svg?component';
	import type { Player } from './+page.server';

	export let player: Player;
</script>

<a class="player-wrapper" href="https://colonist.io/profile/{player.username}" target="_blank">
	<div class="row gap m-column center">
		<div class="row gap center">
			<h2 class:first={player.rank === 0}>{player.rank + 1}</h2>
			<div class="player name">
				<h3>{player.username}</h3>
				<p>{player.points} Points</p>
			</div>
		</div>
		<div class="row gap center">
			<div class="player center">
				<h4>Streak</h4>
				<div>
					<p class={player.winStreak >= player.lossStreak ? 'win chip' : 'loss chip'}>
						{player.winStreak >= player.lossStreak
							? `${player.winStreak} W`
							: `${player.lossStreak} L`}
					</p>
				</div>
			</div>
			<div class="player center">
				<h4>Longest Streak</h4>
				<div>
					<p class="chip">{player.longestWinStreak} W</p>
					<p class="chip">{player.longestLossStreak} L</p>
				</div>
			</div>
			<div class="player center">
				<h4>Win %</h4>
				<p class="chip clear">{Math.round(player.winPercent * 100)}%</p>
			</div>
		</div>
	</div>

	<div class="row medal-wrapper center">
		<div class="row medals center">
			<Gold alt="Gold medal icon" />
			<p>{player.ranks[0]}</p>
		</div>
		<div class="row medals center">
			<Silver alt="Silver medal icon" />
			<p>{player.ranks[1]}</p>
		</div>
		<div class="row medals center">
			<Bronze alt="Bronze medal icon" />
			<p>{player.ranks[2]}</p>
		</div>
	</div>
</a>

<style>
	.player-wrapper {
		color: var(--font);
		text-decoration: none;
		box-sizing: border-box;
		background-color: var(--surface);
		border-radius: 12px;
		padding: 8px 18px;
		margin-bottom: 16px;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		transition: background-color 0.2s;
	}

	.player-wrapper:focus-visible {
		outline: 2px solid var(--blue-font);
	}

	.player-wrapper:hover {
		background-color: var(--surface-hover);
	}

	h2 {
		font-size: 24px;
		padding: 15px;
		border-radius: 12px;
		color: var(--blue-font);
		background-color: var(--blue-background);
	}

	.first {
		color: var(--gold-font);
		background-color: var(--gold-background);
	}

	.row {
		display: flex;
		flex-direction: row;
	}

	.gap {
		gap: 32px;
	}

	.name {
		width: 100px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.player {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.center {
		align-items: center;
	}

	.player h3 {
		font-size: 18px;
		color: var(--font);
	}

	.player h4 {
		font-size: 14px;
		opacity: 0.4;
		color: var(--font);
	}

	.player p {
		font-size: 14px;
		color: var(--light-font);
	}

	.medal-wrapper {
		gap: 6px;
	}

	.medals {
		justify-content: center;
		background-color: var(--background);
		padding: 6px 10px 6px 6px;
		min-width: 60px;
		border-radius: 8px;
		gap: 4px;
	}

	.medals :global(svg) {
		height: 24px;
	}

	p.chip {
		display: inline-block;
		padding: 4px 6px;
		border-radius: 4px;
		color: var(--light-font);
		background-color: var(--nav-hover);
		min-width: 24px;
		text-align: center;
	}

	p.clear {
		background-color: transparent;
	}

	p.win {
		color: var(--green-font);
		background-color: var(--green-background);
	}

	p.loss {
		color: var(--red-font);
		background-color: var(--red-background);
	}

	@media only screen and (max-width: 768px) {
		.player-wrapper {
			flex-direction: column;
			gap: 16px;
		}

		.gap {
			gap: 16px;
		}
	}

	@media only screen and (max-width: 500px) {
		.m-column {
			flex-direction: column;
		}
	}
</style>
