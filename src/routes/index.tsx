import { Meta, Title } from "@solidjs/meta";
import { RoutePreloadFuncArgs, useSearchParams } from "@solidjs/router";
import { For, Loading, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import ConfirmDialog from "~/components/ConfirmDialog";
import MatchHistory, { formatFullDate, ordinal } from "~/components/MatchHistory";
import Overview from "~/components/Overview";
import PlayerEntry from "~/components/PlayerEntry";
import { getLeaderboard } from "~/lib/api";
import bookmarkFilledSvg from "~/lib/assets/bookmark-filled.svg?raw";
import bookmarkSvg from "~/lib/assets/bookmark.svg?raw";
import dataSvg from "~/lib/assets/data.svg?raw";
import deleteSvg from "~/lib/assets/delete.svg?raw";
import dismissSvg from "~/lib/assets/dismiss.svg?raw";
import historySvg from "~/lib/assets/history.svg?raw";
import homeSvg from "~/lib/assets/home.svg?raw";
import linkOutSvg from "~/lib/assets/link-out.svg?raw";
import moonSvg from "~/lib/assets/moon.svg?raw";
import peopleCheckSvg from "~/lib/assets/people-check.svg?raw";
import peopleSvg from "~/lib/assets/people.svg?raw";
import playSvg from "~/lib/assets/play.svg?raw";
import searchSvg from "~/lib/assets/search.svg?raw";
import sunnySvg from "~/lib/assets/sunny.svg?raw";
import { createLocalSignal } from "~/lib/createLocalSignal";
import { formatDuration } from "~/lib/format";
import type { MatchHistoryGame } from "~/lib/types";

interface Bookmark {
    name: string;
    usernames: string;
    exact: boolean;
}

export const route = {
    preload({ location }: RoutePreloadFuncArgs) {
        const params = new URLSearchParams(location.search);
        if (params.get("usernames")) {
            getLeaderboard(
                params.get("usernames") ?? "",
                (params.get("exact") ?? "true") === "true",
                params.get("limit") ?? "",
            );
        }
    },
};

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    const usernames = createMemo(() =>
        searchParams.usernames ? String(searchParams.usernames) : "",
    );
    const [formUsernames, setUsernames] = createSignal(() => usernames());
    const exact = createMemo(() => (searchParams.exact ?? "true") === "true");

    const [bookmarks, setBookmarks] = createLocalSignal<Bookmark[]>("bookmarks", []);
    const [bookmarkName, setBookmarkName] = createSignal("");
    const [deletingBookmark, setDeletingBookmark] = createSignal<string | null>(null);
    const [hoveredPlayer, setHoveredPlayer] = createSignal<string | null>(null);
    const [activeTab, setActiveTab] = createSignal<"details" | "overview">("details");
    const [showBookmarks, setShowBookmarks] = createSignal(false);
    const [selectedGame, setSelectedGame] = createSignal<MatchHistoryGame | null>(null);
    const [showHistory, setShowHistory] = createSignal(false);
    const [theme, setTheme] = createLocalSignal<"light" | "dark">(
        "theme",
        typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
    );

    createEffect(theme, (theme) => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(theme);
    });

    const toggleTheme = () => {
        const next = theme() === "light" ? "dark" : "light";
        setTheme(next);
    };

    const isBookmarked = createMemo(() => {
        const current = formUsernames().trim();
        if (!current) return false;
        return bookmarks().some((b) => b.usernames === current && b.exact === exact());
    });

    const leaderboard = createMemo(async () =>
        usernames()
            ? await getLeaderboard(usernames(), exact(), (searchParams.limit as string) ?? "")
            : undefined,
    );

    let bookmarkRef: HTMLDivElement | undefined;
    let bookmarkDrawerRef: HTMLDivElement | undefined;

    createEffect(
        () => {},
        () => {
            const lastQuery = JSON.parse(localStorage.getItem("lastQuery") ?? "null");

            if (!usernames() && lastQuery?.usernames) {
                setSearchParams({
                    usernames: lastQuery.usernames,
                    exact: !lastQuery.exact ? false : undefined,
                });
            }
        },
    );

    createEffect(
        () => [usernames(), exact()],
        ([usernames, exact]) => {
            localStorage.setItem("lastQuery", JSON.stringify({ usernames, exact }));
        },
    );

    onSettled(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                showBookmarks() &&
                bookmarkRef &&
                !bookmarkRef.contains(e.target as Node) &&
                (!bookmarkDrawerRef || !bookmarkDrawerRef.contains(e.target as Node))
            ) {
                setShowBookmarks(false);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    });

    const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();
        setSearchParams({
            usernames: formUsernames() ? formUsernames() : undefined,
        });
    };

    const saveBookmark = () => {
        const name = bookmarkName().trim();
        const currentUsernames = formUsernames().trim();
        if (!name || !currentUsernames) return;
        setBookmarks((prev) => [
            ...prev.filter((b) => b.name !== name),
            { name, usernames: currentUsernames, exact: exact() },
        ]);
        setBookmarkName("");
        setShowBookmarks(false);
    };

    const loadBookmark = (bookmark: Bookmark) => {
        setSearchParams({
            usernames: bookmark.usernames,
            exact: !bookmark.exact ? false : undefined,
        });
    };

    const deleteBookmark = (name: string) => {
        setDeletingBookmark(name);
    };

    const confirmDelete = () => {
        const name = deletingBookmark();
        if (!name) return;
        setBookmarks((prev) => prev.filter((b) => b.name !== name));
        setDeletingBookmark(null);
    };

    const title = createMemo(() => {
        const lb = leaderboard();
        return `Rankings for ${
            lb && lb.players.length > 0
                ? lb.players.map((p) => p.username).join(", ")
                : (searchParams.usernames ?? "")
        }`;
    });

    const ogDescription = createMemo(() => {
        const lb = leaderboard();
        if (!lb) return "";
        return lb.players
            .map(
                (player) =>
                    `${player.rank + 1}. ${player.username} (${player.points} Points${
                        player.winStreak > 0 ? `, ${player.winStreak} W` : ""
                    })`,
            )
            .concat([`Games: ${lb.games}`])
            .join("\n");
    });

    return (
        <>
            <Loading>
                <Show when={leaderboard()}>
                    <Title>{title()}</Title>
                    <Meta property="og:title" content={title()} />
                    <Meta property="og:description" content={ogDescription()} />
                </Show>
            </Loading>

            <nav>
                <div class="nav-center">
                    <a class="nav-logo" href="/">
                        CL
                    </a>

                    <form class="nav-search" onSubmit={onSubmit}>
                        <div class="input">
                            <input
                                type="text"
                                placeholder="Search players"
                                value={usernames()}
                                onInput={(e) => setUsernames(e.currentTarget.value)}
                                name="usernames"
                                autocapitalize="none"
                            />
                            <button
                                type="button"
                                class={["exact-btn has-tooltip", { "exact-btn-active": exact() }]}
                                onClick={() =>
                                    setSearchParams({ exact: exact() ? false : undefined })
                                }
                            >
                                <span innerHTML={exact() ? peopleCheckSvg : peopleSvg} />
                                <span class="tooltip">Exact player match</span>
                            </button>
                            <button type="submit" class="has-tooltip">
                                <span innerHTML={searchSvg} />
                                <span class="tooltip">Search</span>
                            </button>
                        </div>
                        <div class="bookmark-container" ref={(ref) => (bookmarkRef = ref)}>
                            <button
                                type="button"
                                class="bookmark-btn has-tooltip"
                                onClick={() => setShowBookmarks((v) => !v)}
                            >
                                <span
                                    innerHTML={isBookmarked() ? bookmarkFilledSvg : bookmarkSvg}
                                />
                                <span class="tooltip">Bookmarks</span>
                            </button>
                        </div>
                    </form>

                    <div class="nav-actions">
                        <a class="nav-link" href="https://colonist.io/" target="_blank">
                            <p>Colonist.io</p>
                            <span innerHTML={linkOutSvg} />
                        </a>

                        <button type="button" class="theme-btn has-tooltip" onClick={toggleTheme}>
                            <span innerHTML={theme() === "dark" ? moonSvg : sunnySvg} />
                            <span class="tooltip">
                                {theme() === "dark" ? "Dark mode" : "Light mode"}
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            <Loading
                fallback={
                    <main>
                        <div class="content-layout">
                            <div class="rankings-col">
                                <div class="tabs">
                                    <button class="tab tab-active">Overview</button>
                                    <button class="tab">Visualise</button>
                                </div>
                                <For each={[1, 2, 3]}>
                                    {() => (
                                        <div class="player-card skeleton-card">
                                            <div class="skeleton-card-inner">
                                                <div class="skeleton skeleton-rank" />
                                                <div class="skeleton-info">
                                                    <div class="skeleton skeleton-name" />
                                                    <div class="skeleton skeleton-sub" />
                                                </div>
                                                <div class="skeleton skeleton-stat" />
                                                <div class="skeleton skeleton-stat" />
                                                <div class="skeleton skeleton-stat" />
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                            <div class="history-col">
                                <div class="match-history">
                                    <div class="skeleton skeleton-history-title" />
                                    <For each={[1, 2, 3, 4, 5]}>
                                        {() => <div class="skeleton skeleton-history-row" />}
                                    </For>
                                </div>
                            </div>
                        </div>
                    </main>
                }
            >
                <Show
                    when={leaderboard()}
                    fallback={
                        <div class="empty-state">
                            <h2>Colonist Leaderboards</h2>
                            <p class="empty-hint">
                                Search player names
                                {bookmarks().length > 0 ? " or load a bookmark" : ""} to compare
                                stats
                            </p>
                            <Show when={bookmarks().length > 0}>
                                <div class="empty-bookmarks">
                                    <div class="empty-bookmarks-list">
                                        <For each={bookmarks()}>
                                            {(bookmark) => (
                                                <button
                                                    class="empty-bookmark-chip"
                                                    onClick={() => loadBookmark(bookmark())}
                                                >
                                                    {bookmark().name}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    }
                >
                    {(lb) => (
                        <>
                            <main>
                                <Show
                                    when={lb().players.length > 0}
                                    fallback={
                                        <div class="empty-state">
                                            <h2>No games</h2>
                                        </div>
                                    }
                                >
                                    <div class="content-layout">
                                        <div class="rankings-col">
                                            <div class="tabs">
                                                <button
                                                    class={[
                                                        "tab",
                                                        { "tab-active": activeTab() === "details" },
                                                    ]}
                                                    onClick={() => setActiveTab("details")}
                                                >
                                                    Overview
                                                </button>
                                                <button
                                                    class={[
                                                        "tab",
                                                        {
                                                            "tab-active":
                                                                activeTab() === "overview",
                                                        },
                                                    ]}
                                                    onClick={() => setActiveTab("overview")}
                                                >
                                                    Visualise
                                                </button>
                                            </div>

                                            <Show when={activeTab() === "details"}>
                                                <For each={lb().players}>
                                                    {(player) => (
                                                        <PlayerEntry
                                                            player={player()}
                                                            onHover={setHoveredPlayer}
                                                            hideGames={
                                                                (searchParams.exact ?? "true") ===
                                                                "true"
                                                            }
                                                        />
                                                    )}
                                                </For>
                                            </Show>

                                            <Show when={activeTab() === "overview"}>
                                                <Overview leaderboard={lb()} />
                                            </Show>
                                        </div>
                                        <div
                                            class={[
                                                "history-col",
                                                { "history-drawer-open": showHistory() },
                                            ]}
                                        >
                                            <div
                                                class="history-drawer-overlay"
                                                onClick={() => setShowHistory(false)}
                                            />
                                            <MatchHistory
                                                games={lb().matchHistory}
                                                hoveredPlayer={hoveredPlayer()}
                                                totalGames={lb().games}
                                                onSelectGame={(game) => {
                                                    setSelectedGame(game);
                                                    setShowHistory(false);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </Show>
                            </main>
                        </>
                    )}
                </Show>
            </Loading>

            <Show when={selectedGame()}>
                {(game) => (
                    <div class="dialog-overlay" onClick={() => setSelectedGame(null)}>
                        <div class="match-dialog" onClick={(e) => e.stopPropagation()}>
                            <div class="match-dialog-header">
                                <h3>Match Details</h3>
                                <button
                                    class="match-dialog-close"
                                    onClick={() => setSelectedGame(null)}
                                >
                                    <span innerHTML={dismissSvg} />
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
                                            class={[
                                                "match-dialog-player-row",
                                                { "match-dialog-winner": player().rank === 1 },
                                            ]}
                                        >
                                            <span class="mdp-place">
                                                <span
                                                    class={{
                                                        "win chip": player().rank === 1,
                                                        "loss chip": player().rank !== 1,
                                                    }}
                                                >
                                                    {ordinal(player().rank)}
                                                </span>
                                            </span>
                                            <span class="mdp-name">{player().username}</span>
                                            <span class="mdp-vp">{player().vp}</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>
                )}
            </Show>

            <div
                class={["bookmark-drawer", { "bookmark-drawer-open": showBookmarks() }]}
                ref={(ref) => (bookmarkDrawerRef = ref)}
            >
                <div class="bookmark-drawer-overlay" onClick={() => setShowBookmarks(false)} />
                <div
                    class="bookmark-dropdown"
                    style={(() => {
                        if (!showBookmarks() || !bookmarkRef) return {};
                        const rect = bookmarkRef.getBoundingClientRect();
                        return {
                            "--bookmark-top": `${rect.bottom + 8}px`,
                            "--bookmark-right": `${window.innerWidth - rect.right}px`,
                        };
                    })()}
                >
                    <Show when={!isBookmarked()}>
                        <div class="bookmark-save-row">
                            <input
                                type="text"
                                class="bookmark-name-input"
                                placeholder="Bookmark name"
                                value={bookmarkName()}
                                onInput={(e) => setBookmarkName(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") saveBookmark();
                                    if (e.key === "Escape") setShowBookmarks(false);
                                }}
                            />
                            <button type="button" class="bookmark-save-btn" onClick={saveBookmark}>
                                Save
                            </button>
                        </div>
                    </Show>
                    <Show when={bookmarks().length > 0}>
                        <div class="bookmark-list">
                            <For each={bookmarks()}>
                                {(bookmark) => (
                                    <div class="bookmark-item">
                                        <button
                                            class="bookmark-load"
                                            onClick={() => {
                                                loadBookmark(bookmark());
                                                setShowBookmarks(false);
                                            }}
                                        >
                                            {bookmark().name}
                                        </button>
                                        <button
                                            class="bookmark-delete"
                                            onClick={() => deleteBookmark(bookmark().name)}
                                        >
                                            <span innerHTML={deleteSvg} />
                                        </button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                    <Show when={bookmarks().length === 0 && isBookmarked()}>
                        <p class="bookmark-empty">No bookmarks</p>
                    </Show>
                </div>
            </div>

            <ConfirmDialog
                message={`Delete bookmark "${deletingBookmark()}"?`}
                open={deletingBookmark() !== null}
                onConfirm={confirmDelete}
                onCancel={() => setDeletingBookmark(null)}
            />

            <div class="bottom-nav">
                <button
                    class={["bottom-nav-item", { "bottom-nav-active": activeTab() === "details" }]}
                    onClick={() => setActiveTab("details")}
                >
                    <span innerHTML={homeSvg} />
                    <span>Overview</span>
                </button>
                <button
                    class={["bottom-nav-item", { "bottom-nav-active": activeTab() === "overview" }]}
                    onClick={() => setActiveTab("overview")}
                >
                    <span innerHTML={dataSvg} />
                    <span>Visualise</span>
                </button>
                <button class="bottom-nav-item" onClick={() => setShowHistory(true)}>
                    <span innerHTML={historySvg} />
                    <span>History</span>
                </button>
                <button
                    class={["bottom-nav-item", { "bottom-nav-active": showBookmarks() }]}
                    on:click={(e) => {
                        e.stopPropagation();
                        setShowBookmarks(!showBookmarks());
                    }}
                >
                    <span innerHTML={showBookmarks() ? bookmarkFilledSvg : bookmarkSvg} />
                    <span>Bookmarks</span>
                </button>
                <a class="bottom-nav-item" href="https://colonist.io/" target="_blank">
                    <span innerHTML={playSvg} />
                    <span>Play</span>
                </a>
            </div>
        </>
    );
}
