import { createMemo, For } from "solid-js";
import { formatDuration } from "~/lib/format";
import type { MatchHistoryGame } from "~/lib/types";

function formatDate(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatFullDate(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function ordinal(rank: number): string {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd";
    if (rank === 3) return "3rd";
    return `${rank}th`;
}

export default function MatchHistory(props: {
    games: MatchHistoryGame[];
    hoveredPlayer: string | null;
    totalGames: number;
    onSelectGame: (game: MatchHistoryGame) => void;
}) {
    return (
        <div class="match-history">
            <div class="mh-header">
                <h3 class="mh-title">Match History</h3>
                <span class="mh-stats">{props.totalGames} games</span>
            </div>
            <div class="mh-list">
                <For each={props.games}>
                    {(game) => {
                        const winner = createMemo(() => game().players.find((p) => p.rank === 1));
                        const myPlayer = createMemo(() =>
                            props.hoveredPlayer === null
                                ? null
                                : game().players.find((p) => p.username === props.hoveredPlayer),
                        );

                        return (
                            <button
                                class={[
                                    "mh-row",
                                    {
                                        "mh-highlighted": myPlayer()?.rank === 1,
                                        "mh-dimmed": props.hoveredPlayer !== null && !myPlayer(),
                                    },
                                ]}
                                onClick={() => {
                                    props.onSelectGame(game());
                                }}
                            >
                                <span class="mh-date">{formatDate(game().date)}</span>
                                <span class="mh-winner">{winner()?.username ?? "—"}</span>
                                <span class="mh-detail">{formatDuration(game().duration)}</span>
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}
