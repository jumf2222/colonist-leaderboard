import { For } from "solid-js";
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
                        const winner = () => game().players.find((p) => p.rank === 1);
                        const isHighlighted = () =>
                            props.hoveredPlayer !== null &&
                            game().players.some(
                                (p) => p.username === props.hoveredPlayer && p.rank === 1,
                            );
                        const isInvolved = () =>
                            props.hoveredPlayer !== null &&
                            game().players.some((p) => p.username === props.hoveredPlayer);
                        const isDimmed = () => props.hoveredPlayer !== null && !isInvolved();

                        return (
                            <button
                                class={[
                                    "mh-row",
                                    {
                                        "mh-highlighted": isHighlighted(),
                                        "mh-dimmed": isDimmed(),
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
