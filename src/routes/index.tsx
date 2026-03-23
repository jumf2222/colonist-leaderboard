import {
	createAsync,
	useSearchParams,
	useNavigate,
	type RoutePreloadFuncArgs
} from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { For, Show, onMount, createMemo, createSignal, batch } from 'solid-js';
import ConfirmDialog from '~/components/ConfirmDialog';
import { getLeaderboard } from '~/lib/api';
import { formatDuration } from '~/lib/format';
import { createLocalSignal } from '~/lib/createLocalSignal';
import PlayerEntry from '~/components/PlayerEntry';
import MatchHistory from '~/components/MatchHistory';
import Overview from '~/components/Overview';
import linkOutSvg from '~/lib/assets/link-out.svg?raw';
import addPeopleSvg from '~/lib/assets/add-people.svg?raw';

interface Bookmark {
	name: string;
	usernames: string;
	exact: boolean;
}

export const route = {
	preload({ location }: RoutePreloadFuncArgs) {
		const params = new URLSearchParams(location.search);
		getLeaderboard(
			params.get('usernames') ?? '',
			(params.get('exact') ?? 'true') === 'true',
			params.get('limit') ?? ''
		);
	}
};

export default function Home() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [usernames, setUsernames] = createLocalSignal('usernames', '');
	const [exact, setExact] = createLocalSignal('exact', true);
	const [bookmarks, setBookmarks] = createLocalSignal<Bookmark[]>('bookmarks', []);
	const [bookmarkName, setBookmarkName] = createSignal('');
	const [showBookmarkInput, setShowBookmarkInput] = createSignal(false);
	const [deletingBookmark, setDeletingBookmark] = createSignal<string | null>(null);
	const [hoveredPlayer, setHoveredPlayer] = createSignal<string | null>(null);
	const [activeTab, setActiveTab] = createSignal<'details' | 'overview'>('details');

	const leaderboard = createAsync(() =>
		getLeaderboard(
			(searchParams.usernames as string) ?? '',
			(searchParams.exact ?? 'true') === 'true',
			(searchParams.limit as string) ?? ''
		)
	);

	createMemo(() => {
		if (searchParams.usernames) setUsernames(searchParams.usernames as string);
	});
	createMemo(() => {
		if (searchParams.exact !== undefined) setExact(searchParams.exact === 'true');
	});

	onMount(() => {
		if (
			(usernames() && searchParams.usernames !== usernames()) ||
			(!exact() && searchParams.exact !== String(exact()))
		) {
			search();
		}
	});

	const search = () => {
		const params = new URLSearchParams({
			...(usernames() && { usernames: usernames() }),
			...(!exact() && { exact: String(exact()) })
		}).toString();

		navigate(params ? `/?${params}` : '/', { resolve: false });
	};

	const onSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		search();
	};

	const onExactChange = (e: Event) => {
		setExact((e.target as HTMLInputElement).checked);
		search();
	};

	const saveBookmark = () => {
		const name = bookmarkName().trim();
		const currentUsernames = usernames().trim();
		if (!name || !currentUsernames) return;
		setBookmarks((prev) => [
			...prev.filter((b) => b.name !== name),
			{ name, usernames: currentUsernames, exact: exact() }
		]);
		setBookmarkName('');
		setShowBookmarkInput(false);
	};

	const loadBookmark = (bookmark: Bookmark) => {
		setUsernames(bookmark.usernames);
		setExact(bookmark.exact);
		search();
	};

	const deleteBookmark = (name: string) => {
		setDeletingBookmark(name);
	};

	const confirmDelete = () => {
		const name = deletingBookmark();
		if (!name) return;
		batch(() => {
			setBookmarks((prev) => prev.filter((b) => b.name !== name));
			setDeletingBookmark(null);
		});
	};

	const title = createMemo(() => {
		const lb = leaderboard();
		return `Rankings for ${
			lb && lb.players.length > 0
				? lb.players.map((p) => p.username).join(', ')
				: searchParams.usernames ?? ''
		}`;
	});

	const ogDescription = createMemo(() => {
		const lb = leaderboard();
		if (!lb) return '';
		return lb.players
			.map(
				(player) =>
					`${player.rank + 1}. ${player.username} (${player.points} Points${
						player.winStreak > 0 ? `, ${player.winStreak} W` : ''
					})`
			)
			.concat([`Games: ${lb.games}`])
			.join('\n');
	});

	return (
		<>
			<Show when={leaderboard()}>
				<Title>{title()}</Title>
				<Meta property="og:title" content={title()} />
				<Meta property="og:description" content={ogDescription()} />
			</Show>

			<nav>
				<div class="nav-center">
					<a class="nav-link" href="https://colonist.io/" target="_blank">
						<p>Colonist</p>
						<span innerHTML={linkOutSvg} />
					</a>

					<form class="nav-search" onSubmit={onSubmit}>
						<div class="input">
							<input
								type="text"
								placeholder="Enter players..."
								value={usernames()}
								onInput={(e) => setUsernames(e.currentTarget.value)}
								name="usernames"
							/>
							<button type="submit">
								<span innerHTML={addPeopleSvg} />
							</button>
						</div>
						<label class="checkbox-label">
							Exact
							<input type="checkbox" checked={exact()} name="exact" onChange={onExactChange} />
						</label>
						<button
							type="button"
							class="bookmark-btn"
							title="Bookmark current players"
							onClick={() => setShowBookmarkInput((v) => !v)}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
								<path
									d="M6 2C5.44772 2 5 2.44772 5 3V21C5 21.3746 5.21608 21.7178 5.55279 21.8944C5.88951 22.0711 6.29443 22.0517 6.6139 21.8444L12 18.2229L17.3861 21.8444C17.7056 22.0517 18.1105 22.0711 18.4472 21.8944C18.7839 21.7178 19 21.3746 19 21V3C19 2.44772 18.5523 2 18 2H6Z"
									fill="currentColor"
								/>
							</svg>
						</button>
					</form>
				</div>
			</nav>

			<Show when={showBookmarkInput()}>
				<div class="bookmark-save-row">
					<input
						type="text"
						class="bookmark-name-input"
						placeholder="Bookmark name..."
						value={bookmarkName()}
						onInput={(e) => setBookmarkName(e.currentTarget.value)}
						onKeyDown={(e) => e.key === 'Enter' && saveBookmark()}
					/>
					<button class="bookmark-save-btn" onClick={saveBookmark}>
						Save
					</button>
				</div>
			</Show>

			<Show when={bookmarks().length > 0}>
				<div class="bookmarks-list">
					<For each={bookmarks()}>
						{(bookmark) => (
							<div class="bookmark-chip">
								<button class="bookmark-load" onClick={() => loadBookmark(bookmark)}>
									{bookmark.name}
								</button>
								<button
									class="bookmark-delete"
									onClick={() => deleteBookmark(bookmark.name)}
								>
									&times;
								</button>
							</div>
						)}
					</For>
				</div>
			</Show>

			<Show when={leaderboard()}>
				{(lb) => (
					<>
						<div class="stats-bar">
							<p>Games played: {lb().games}</p>
							{lb().avgDuration > 0 && (
								<p>Avg Duration: {formatDuration(lb().avgDuration)}</p>
							)}
						</div>

						<main>
							<Show when={lb().players.length > 0} fallback={<h2>No games</h2>}>
								<div class="tabs">
									<button
										class="tab"
										classList={{ 'tab-active': activeTab() === 'details' }}
										onClick={() => setActiveTab('details')}
									>
										Match Details
									</button>
									<button
										class="tab"
										classList={{ 'tab-active': activeTab() === 'overview' }}
										onClick={() => setActiveTab('overview')}
									>
										Overview
									</button>
								</div>

								<Show when={activeTab() === 'details'}>
									<div class="content-layout">
										<div class="rankings-col">
											<For each={lb().players}>
												{(player) => (
													<PlayerEntry
														player={player}
														onHover={setHoveredPlayer}
													/>
												)}
											</For>
										</div>
										<div class="history-col">
											<MatchHistory
												games={lb().matchHistory}
												hoveredPlayer={hoveredPlayer()}
											/>
										</div>
									</div>
								</Show>

								<Show when={activeTab() === 'overview'}>
									<Overview leaderboard={lb()} />
								</Show>
							</Show>
						</main>
					</>
				)}
			</Show>

			<ConfirmDialog
				message={`Delete bookmark "${deletingBookmark()}"?`}
				open={deletingBookmark() !== null}
				onConfirm={confirmDelete}
				onCancel={() => setDeletingBookmark(null)}
			/>
		</>
	);
}
