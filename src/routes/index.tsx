import {
	createAsync,
	useSearchParams,
	useNavigate,
	type RoutePreloadFuncArgs
} from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { For, Show, onMount, onCleanup, createMemo, createSignal, batch } from 'solid-js';
import ConfirmDialog from '~/components/ConfirmDialog';
import { getLeaderboard } from '~/lib/api';
import { createLocalSignal } from '~/lib/createLocalSignal';
import PlayerEntry from '~/components/PlayerEntry';
import MatchHistory from '~/components/MatchHistory';
import Overview from '~/components/Overview';
import linkOutSvg from '~/lib/assets/link-out.svg?raw';
import searchSvg from '~/lib/assets/ic_fluent_search_24_regular.svg?raw';
import bookmarkAddSvg from '~/lib/assets/bookmark_add.svg?raw';
import peopleSvg from '~/lib/assets/people_24_regular.svg?raw';
import peopleCheckSvg from '~/lib/assets/people_checkmark_24_regular.svg?raw';
import sunnySvg from '~/lib/assets/sunny.svg?raw';
import moonSvg from '~/lib/assets/moon.svg?raw';

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
	const [showBookmarks, setShowBookmarks] = createSignal(false);
	const [theme, setTheme] = createLocalSignal<'light' | 'dark'>('theme',
		typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
	);

	const applyTheme = (t: 'light' | 'dark') => {
		const root = document.documentElement;
		root.classList.remove('light', 'dark');
		root.classList.add(t);
	};

	const toggleTheme = () => {
		const next = theme() === 'light' ? 'dark' : 'light';
		setTheme(next);
		applyTheme(next);
	};

	const isBookmarked = createMemo(() => {
		const current = usernames().trim();
		if (!current) return false;
		return bookmarks().some((b) => b.usernames === current && b.exact === exact());
	});

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

	let bookmarkRef: HTMLDivElement | undefined;

	onMount(() => {
		applyTheme(theme());

		if (
			(usernames() && searchParams.usernames !== usernames()) ||
			(!exact() && searchParams.exact !== String(exact()))
		) {
			search();
		}

		const handleClickOutside = (e: MouseEvent) => {
			if (showBookmarks() && bookmarkRef && !bookmarkRef.contains(e.target as Node)) {
				setShowBookmarks(false);
			}
		};
		document.addEventListener('click', handleClickOutside);
		onCleanup(() => document.removeEventListener('click', handleClickOutside));
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
					<a class="nav-logo" href="/">CL</a>

					<form class="nav-search" onSubmit={onSubmit}>
						<div class="input">
							<input
								type="text"
								placeholder="Search players..."
								value={usernames()}
								onInput={(e) => setUsernames(e.currentTarget.value)}
								name="usernames"
							/>
							<button
								type="button"
								class="exact-btn has-tooltip"
								classList={{ 'exact-btn-active': exact() }}
								onClick={() => { setExact((v) => !v); search(); }}
							>
								<span innerHTML={exact() ? peopleCheckSvg : peopleSvg} />
								<span class="tooltip">Exact player match</span>
							</button>
							<button type="submit" class="has-tooltip">
								<span innerHTML={searchSvg} />
								<span class="tooltip">Search</span>
							</button>
						</div>
						<button
							type="button"
							class="bookmark-btn has-tooltip"
							disabled={isBookmarked()}
							onClick={() => {
								setShowBookmarkInput(true);
								setShowBookmarks(false);
							}}
						>
							<span innerHTML={bookmarkAddSvg} />
							<span class="tooltip">Bookmark group</span>
						</button>
						<div class="bookmark-container" ref={bookmarkRef}>
							<button
								type="button"
								class="bookmark-btn has-tooltip"
								onClick={() => {
									setShowBookmarks((v) => !v);
									setShowBookmarkInput(false);
								}}
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path
										d="M6 2C5.44772 2 5 2.44772 5 3V21C5 21.3746 5.21608 21.7178 5.55279 21.8944C5.88951 22.0711 6.29443 22.0517 6.6139 21.8444L12 18.2229L17.3861 21.8444C17.7056 22.0517 18.1105 22.0711 18.4472 21.8944C18.7839 21.7178 19 21.3746 19 21V3C19 2.44772 18.5523 2 18 2H6Z"
										fill="currentColor"
									/>
								</svg>
								<span class="tooltip">Bookmarks</span>
							</button>
							<Show when={showBookmarks()}>
								<div class="bookmark-dropdown">
									<Show when={bookmarks().length > 0} fallback={<p class="bookmark-empty">No bookmarks</p>}>
										<div class="bookmark-list">
											<For each={bookmarks()}>
												{(bookmark) => (
													<div class="bookmark-item">
														<button class="bookmark-load" onClick={() => { loadBookmark(bookmark); setShowBookmarks(false); }}>
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
								</div>
							</Show>
						</div>
					</form>

					<button
						type="button"
						class="theme-btn has-tooltip"
						onClick={toggleTheme}
					>
						<span innerHTML={theme() === 'dark' ? moonSvg : sunnySvg} />
						<span class="tooltip">{theme() === 'dark' ? 'Dark mode' : 'Light mode'}</span>
					</button>

					<a class="nav-link" href="https://colonist.io/" target="_blank">
						<p>Colonist.io</p>
						<span innerHTML={linkOutSvg} />
					</a>
				</div>
			</nav>

			<Show when={leaderboard()} fallback={
				<div class="empty-state">
					<h2>Colonist Leaderboard</h2>
					<p class="empty-hint">Search player names above to compare stats</p>
					<Show when={bookmarks().length > 0}>
						<div class="empty-bookmarks">
							<p class="empty-bookmarks-label">Or load a bookmark</p>
							<div class="empty-bookmarks-list">
								<For each={bookmarks()}>
									{(bookmark) => (
										<button class="empty-bookmark-chip" onClick={() => loadBookmark(bookmark)}>
											{bookmark.name}
										</button>
									)}
								</For>
							</div>
						</div>
					</Show>
				</div>
			}>
				{(lb) => (
					<>
						<main>
							<Show when={lb().players.length > 0} fallback={<div class="empty-state"><h2>No games</h2></div>}>
								<div class="content-layout">
									<div class="rankings-col">
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
											<For each={lb().players}>
												{(player) => (
													<PlayerEntry
														player={player}
														onHover={setHoveredPlayer}
														hideGames={(searchParams.exact ?? 'true') === 'true'}
													/>
												)}
											</For>
										</Show>

										<Show when={activeTab() === 'overview'}>
											<Overview leaderboard={lb()} />
										</Show>
									</div>
									<div class="history-col">
										<MatchHistory
											games={lb().matchHistory}
											hoveredPlayer={hoveredPlayer()}
											totalGames={lb().games}
											avgDuration={lb().avgDuration}
										/>
									</div>
								</div>
							</Show>
						</main>
					</>
				)}
			</Show>

			<Show when={showBookmarkInput()}>
				<div class="dialog-overlay" onClick={() => setShowBookmarkInput(false)}>
					<div class="dialog-box" onClick={(e) => e.stopPropagation()}>
						<p class="dialog-message">Bookmark group</p>
						<input
							type="text"
							class="bookmark-name-input"
							placeholder="Bookmark name..."
							value={bookmarkName()}
							onInput={(e) => setBookmarkName(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') saveBookmark();
								if (e.key === 'Escape') setShowBookmarkInput(false);
							}}
						/>
						<div class="dialog-actions">
							<button class="dialog-btn dialog-cancel" onClick={() => setShowBookmarkInput(false)}>
								Cancel
							</button>
							<button class="dialog-btn dialog-save" onClick={saveBookmark}>
								Save
							</button>
						</div>
					</div>
				</div>
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
