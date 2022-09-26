<script lang="ts">
	import '../app.css';
	import LinkOut from '$lib/assets/link-out.svg?component';
	import AddPeople from '$lib/assets/add-people.svg?component';
	import PlayerEntry from './playerEntry.svelte';
	import { savedStore } from '$lib/savedStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { PageData } from './$types';

	let usernames = savedStore('usernames', '');
	let exact = savedStore('exact', true);

	export let data: PageData;

	$: if (data.usernames) $usernames = data.usernames;
	$: if (!data.exact) $exact = data.exact;

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (
			($usernames && params.get('usernames') !== $usernames) ||
			(!$exact && params.get('exact') !== String($exact))
		) {
			search();
		}
	});

	const search = () => {
		const params = new URLSearchParams({
			...($usernames && { usernames: $usernames }),
			...(!$exact && { exact: String($exact) })
		}).toString();

		goto(params ? `/?${params}` : '/', { keepfocus: true });
	};

	const onSubmit: SubmitFunction = ({ cancel }) => {
		cancel();
		search();
	};

	const onExactChange = (event: Event) => {
		$exact = (event.target as HTMLInputElement).checked;
		search();
	};

	$: title = `Rankings for ${
		data.leaderboard && data.leaderboard.players.length > 0
			? data.leaderboard.players.map((player) => player.username).join(', ')
			: data.usernames
	}`;
</script>

<svelte:head>
	{#if data.leaderboard}
		<title>{title}</title>
		<meta property="og:title" content={title} />
		<meta
			property="og:description"
			content={data.leaderboard.players
				.map(
					(player) =>
						`${player.rank + 1}. ${player.username} (${player.points} Points${
							player.winStreak > 0 ? `, ${player.winStreak} W` : ''
						})`
				)
				.concat([`Games: ${data.leaderboard.games}`])
				.join('\n')}
		/>
	{/if}
</svelte:head>

<nav>
	<div class="nav-center">
		<a class="nav-link" href="https://colonist.io/" target="_blank">
			<p>Colonist</p>
			<LinkOut alt="External link icon" />
		</a>
		<p class="games-text">
			{#if data.leaderboard}
				Games played: {data.leaderboard.games}
			{/if}
		</p>
	</div>
</nav>

<main>
	<h1 class="logo">Colonist Leaderboard</h1>

	<form class="form-wrapper" use:enhance={onSubmit} method="post">
		<div class="input">
			<input
				type="text"
				placeholder="Enter a comma-separated list of players..."
				bind:value={$usernames}
				name="usernames"
			/>
			<button>
				<AddPeople alt="Add people icon" />
			</button>
		</div>
		<label class="checkbox-label">
			Exact Match
			<input type="checkbox" checked={$exact} name="exact" on:change={onExactChange} />
		</label>
	</form>

	{#if data.leaderboard}
		{#each data.leaderboard.players as player}
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
		color: var(--blue-font);
		background-color: var(--blue-background);
	}

	.nav-link:focus-visible :global(svg path) {
		fill: var(--blue-font);
	}

	.nav-link:hover {
		color: var(--font);
		background-color: var(--nav-hover);
	}

	.nav-link :global(svg path) {
		fill: var(--light-font);
		transition: fill 0.2s;
	}

	.nav-link :global(svg) {
		height: 20px;
	}

	.nav-link:hover :global(svg path) {
		fill: var(--font);
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

	.form-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		margin-bottom: 24px;
		gap: 12px;
	}

	.checkbox-label {
		height: 50px;
		padding: 0 18px;
		border-radius: 500px;
		cursor: pointer;
		display: flex;
		flex-direction: column-reverse;
		justify-content: center;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		white-space: nowrap;
		color: var(--light-font);
		background-color: var(--surface);
		box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 8px 0px;
		transition: background-color 0.2s;
	}

	[type='checkbox']:focus-visible {
		outline: 2px solid var(--blue-font);
	}

	.checkbox-label:hover {
		background-color: var(--surface-hover);
	}

	/* CHECKBOX */

	[type='checkbox'] {
		width: 16px;
		height: 16px;
		color: var(--blue-font);
		vertical-align: middle;
		-webkit-appearance: none;
		background: none;
		border: 0;
		outline: 0;
		flex-grow: 0;
		border-radius: 50%;
		background-color: var(--background);
		transition: background-color 0.2s;
		cursor: pointer;
	}

	/* Pseudo element for check styling */

	[type='checkbox']::before {
		content: '';
		color: transparent;
		display: block;
		width: inherit;
		height: inherit;
		border-radius: inherit;
		border: 0;
		background-color: transparent;
		background-size: contain;
		box-shadow: inset 0 0 0 1px var(--nav-hover);
	}

	/* Checked */

	[type='checkbox']:checked {
		background-color: var(--checkbox-background);
	}

	[type='checkbox']:checked::before {
		box-shadow: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E %3Cpath d='M15.88 8.29L10 14.17l-1.88-1.88a.996.996 0 1 0-1.41 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7a.996.996 0 0 0 0-1.41c-.39-.39-1.03-.39-1.42 0z' fill='%23fff'/%3E %3C/svg%3E");
	}

	.input {
		flex: 1;
		display: flex;
		max-width: 500px;
		min-width: 0;
		height: 50px;
		background-color: var(--surface);
		border-radius: 500px;
		box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 8px 0px;
	}

	.input input {
		min-width: 0;
		font-size: 16px;
		padding: 0 22px;
		background-color: transparent;
		border: 2px solid transparent;
		border-radius: 500px 0 0 500px;
		flex: 1;
		transition: background-color 0.2s;
	}

	.input input:hover {
		background-color: var(--surface-hover);
	}

	.input input:focus {
		outline: none;
		border: 2px solid var(--blue-font);
		background-color: var(--surface-hover);
	}

	.input input::placeholder {
		color: var(--light-font);
	}

	.input button {
		cursor: pointer;
		background-color: var(--blue-font);
		height: 50px;
		width: 50px;
		border: none;
		padding: 4px;
		border-radius: 0 500px 500px 0;
		transition: background-color 0.2s;
	}

	.input button:focus-visible {
		background-color: var(--font);
	}

	.input button:hover {
		background-color: var(--button-hover);
	}

	.input button :global(svg) {
		margin-right: 3px;
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
