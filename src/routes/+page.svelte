<script lang="ts">
	import '../app.css';
	import LinkOut from '$lib/assets/link-out.svg?component';
	import AddPeople from '$lib/assets/add-people.svg?component';
	import PlayerEntry from './playerEntry.svelte';
	import type { Leaderboard } from './api/leaderboard/+server';
	import { savedStore } from '$lib/savedStore';
	import { onMount } from 'svelte';

	let usernames = savedStore('usernames', '');
	let leaderboard: Leaderboard | undefined;

	const getLeaderboard = async () => {
		const response = await fetch(
			`/api/leaderboard?${new URLSearchParams({ usernames: $usernames })}`,
			{
				headers: { 'content-type': 'application/json' }
			}
		);

		if (response.ok) {
			leaderboard = await response.json();
		}
	};

	onMount(() => {
		if ($usernames) getLeaderboard();
	});
</script>

<svelte:head>
	<title>Colonist Leaderboard</title>
	<meta name="description" content="Colonist Leaderboard by Julian de Rushe and Brian Latchman" />
</svelte:head>

<nav>
	<div class="nav-center">
		<a class="nav-link" href="https://colonist.io/" target="_blank">
			<p>Colonist</p>
			<LinkOut alt="External link icon" />
		</a>
		<p class="games-text">
			{#if leaderboard}
				Games played: {leaderboard.games}
			{/if}
		</p>
	</div>
</nav>

<main>
	<h1 class="logo">Colonist Leaderboard</h1>

	<form class="input" on:submit|preventDefault={getLeaderboard}>
		<input
			type="text"
			placeholder="Enter a comma-separated list of players..."
			bind:value={$usernames}
		/>
		<button>
			<AddPeople alt="Add people icon" />
		</button>
	</form>

	{#if leaderboard}
		{#each leaderboard.players as player}
			<PlayerEntry {player} />
		{:else}
			<h2>No games</h2>
		{/each}
	{/if}
</main>

<style>
	/* NAV SECTION */

	nav {
		font-size: 14px;
		width: 100%;
		height: 42px;
		background-color: var(--surface);
	}

	.nav-center {
		max-width: 900px;
		height: 42px;
		width: 100%;
		margin: auto;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		text-align: center;
	}

	.nav-link {
		height: 100%;
		padding: 0 6px 0 10px;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		cursor: pointer;
		color: var(--light-font);
		background-color: transparent;
		transition: box-shadow 0.2s, color 0.2s, background-color 0.2s;
	}

	.nav-link:focus-visible {
		outline: none;
		color: var(--font);
		background-color: var(--nav-hover);
	}

	.nav-link:focus-visible :global(svg path) {
		fill: var(--font);
	}

	.nav-link:hover {
		color: var(--blue-font);
		background-color: var(--blue-background);
	}

	.nav-link :global(svg path) {
		fill: var(--light-font);
		transition: fill 0.2s;
	}

	.nav-link :global(svg) {
		height: 20px;
	}

	.nav-link:hover :global(svg path) {
		fill: var(--blue-font);
	}

	.games-text {
		color: var(--light-font);
		padding-right: 10px;
	}

	/* MAIN SECTION */

	h2 {
		display: flex;
		justify-content: center;
	}

	main {
		max-width: 900px;
		padding: 0 10px;
		margin: auto;
	}

	.logo {
		font-size: 20px;
		color: var(--blue-font);
		padding: 24px 0 20px 0;
		display: flex;
		justify-content: center;
	}

	.input {
		display: flex;
		max-width: 500px;
		height: 50px;
		margin: auto;
		margin-bottom: 24px;
		background-color: var(--surface);
		border-radius: 500px;
		box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 8px 0px;
	}

	.input input {
		font-size: 16px;
		padding: 0 22px;
		background-color: transparent;
		border: 2px solid transparent;
		border-radius: 500px 0 0 500px;
		flex: 1;
	}

	.input input:focus {
		outline: none;
		border: 2px solid var(--blue-font);
	}

	.input input::placeholder {
		color: var(--light-font);
	}

	.input button {
		cursor: pointer;
		background-color: var(--blue-font);
		height: 40px;
		width: 40px;
		border: none;
		margin: 5px;
		padding: 4px;
		border-radius: 500px;
		transition: background-color 0.2s;
	}

	.input button:focus-visible {
		background-color: var(--font);
		outline: 2px solid var(--blue-font);
	}

	.input button:hover {
		background-color: var(--button-hover);
	}

	.input button :global(svg path) {
		fill: var(--button);
	}

	@media only screen and (max-width: 768px) {
		.logo {
			font-size: 16px;
		}
	}
</style>
