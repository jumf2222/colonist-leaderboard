<script lang="ts">
	import type { Player } from './api/leaderboard/+server';
	import Gold from '$lib/assets/gold.svg?component';
	import Silver from '$lib/assets/silver.svg?component';
	import Bronze from '$lib/assets/bronze.svg?component';

	export let player: Player;
</script>

<a class="player-wrapper" href="https://colonist.io/profile/{player.username}" target="_blank">
	<div class="row left-section">
		<h2 class:first={player.rank === 0}>{player.rank + 1}</h2>
		<div class="player">
			<h3>{player.username}</h3>
			<p>{player.points} Points</p>
		</div>
	</div>

	<div class="row medal-wrapper">
		<div class="row medals">
			<Gold alt="Gold medal icon" />
			<p>{player.ranks[0]}</p>
		</div>
		<div class="row medals">
			<Silver alt="Silver medal icon" />
			<p>{player.ranks[1]}</p>
		</div>
		<div class="row medals">
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
		align-items: center;
	}

	.left-section {
		gap: 16px;
	}

	.player {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.player h3 {
		font-size: 18px;
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
		background-color: var(--background);
		padding: 6px 10px 6px 6px;
		border-radius: 8px;
		gap: 4px;
	}

	.medals :global(svg) {
		height: 24px;
	}

	@media only screen and (max-width: 768px) {
		.player-wrapper {
			flex-direction: column;
			gap: 10px;
		}
	}
</style>
