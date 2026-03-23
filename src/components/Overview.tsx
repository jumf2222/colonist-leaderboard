import { createMemo, createSignal, For, Show } from 'solid-js';
import { formatDuration } from '~/lib/format';
import type { Leaderboard } from '~/lib/types';

const PLAYER_COLORS = [
	'var(--blue-font)',
	'var(--green-font)',
	'var(--red-font)',
	'var(--gold-font)',
	'#AB6FE8',
	'#FF6B9D',
	'#00BFA5',
	'#FF9100'
];

interface ChartPoint {
	x: number;
	y: number;
	label: string;
}

interface ChartSeries {
	name: string;
	color: string;
	points: ChartPoint[];
}

function LineChart(props: {
	series: ChartSeries[];
	yLabel: string;
	formatY?: (v: number) => string;
}) {
	const padding = { top: 20, right: 20, bottom: 30, left: 50 };
	const width = 700;
	const height = 260;
	const innerW = width - padding.left - padding.right;
	const innerH = height - padding.top - padding.bottom;

	const [hoveredIdx, setHoveredIdx] = createSignal<number | null>(null);

	const bounds = createMemo(() => {
		let minY = Infinity;
		let maxY = -Infinity;
		let maxX = 0;
		for (const s of props.series) {
			for (const p of s.points) {
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
				if (p.x > maxX) maxX = p.x;
			}
		}
		if (minY === maxY) {
			minY -= 1;
			maxY += 1;
		}
		const yPad = (maxY - minY) * 0.1;
		return { minY: minY - yPad, maxY: maxY + yPad, maxX };
	});

	const scaleX = (x: number) => padding.left + (bounds().maxX > 0 ? (x / bounds().maxX) * innerW : 0);
	const scaleY = (y: number) => {
		const { minY, maxY } = bounds();
		return padding.top + innerH - ((y - minY) / (maxY - minY)) * innerH;
	};

	const formatY = (v: number) => props.formatY ? props.formatY(v) : String(Math.round(v));

	const yTicks = createMemo(() => {
		const { minY, maxY } = bounds();
		const steps = 4;
		const step = (maxY - minY) / steps;
		return Array.from({ length: steps + 1 }, (_, i) => minY + step * i);
	});

	const pathD = (points: ChartPoint[]) => {
		if (points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`)
			.join(' ');
	};

	return (
		<div class="chart-container">
			<svg viewBox={`0 0 ${width} ${height}`} class="chart-svg">
				{/* Y axis gridlines and labels */}
				<For each={yTicks()}>
					{(tick) => (
						<>
							<line
								x1={padding.left}
								y1={scaleY(tick())}
								x2={width - padding.right}
								y2={scaleY(tick())}
								class="chart-grid"
							/>
							<text
								x={padding.left - 8}
								y={scaleY(tick()) + 4}
								class="chart-label"
								text-anchor="end"
							>
								{formatY(tick())}
							</text>
						</>
					)}
				</For>

				{/* Y axis title */}
				<text
					x={14}
					y={padding.top + innerH / 2}
					class="chart-axis-title"
					text-anchor="middle"
					transform={`rotate(-90, 14, ${padding.top + innerH / 2})`}
				>
					{props.yLabel}
				</text>

				{/* X axis label */}
				<text
					x={padding.left + innerW / 2}
					y={height - 4}
					class="chart-label"
					text-anchor="middle"
				>
					Game #
				</text>

				{/* Lines */}
				<For each={props.series}>
					{(series) => (
						<path
							d={pathD(series().points)}
							fill="none"
							stroke={series().color}
							stroke-width="2"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>
					)}
				</For>

				{/* Hover dots */}
				<Show when={hoveredIdx() !== null}>
					<For each={props.series}>
						{(series) => {
							const pt = () => series().points[hoveredIdx()!];
							return (
								<Show when={pt()}>
									<circle
										cx={scaleX(pt().x)}
										cy={scaleY(pt().y)}
										r="4"
										fill={series().color}
									/>
								</Show>
							);
						}}
					</For>
				</Show>

				{/* Invisible hover zones */}
				<Show when={props.series.length > 0 && props.series[0].points.length > 0}>
					<For each={props.series[0].points}>
						{(_, i) => {
							const x = () => scaleX(props.series[0].points[i()].x);
							const barW = () => Math.max(innerW / props.series[0].points.length, 4);
							return (
								<rect
									x={x() - barW() / 2}
									y={padding.top}
									width={barW()}
									height={innerH}
									fill="transparent"
									onMouseEnter={() => setHoveredIdx(i())}
									onMouseLeave={() => setHoveredIdx(null)}
								/>
							);
						}}
					</For>
				</Show>
			</svg>

			{/* Tooltip */}
			<Show when={hoveredIdx() !== null}>
				<div class="chart-tooltip">
					<For each={props.series}>
						{(series) => {
							const pt = () => series().points[hoveredIdx()!];
							return (
								<Show when={pt()}>
									<div class="chart-tooltip-row">
										<span class="chart-tooltip-dot" style={{ background: series().color }} />
										<span class="chart-tooltip-name">{series().name}</span>
										<span class="chart-tooltip-val">{formatY(pt().y)}</span>
									</div>
								</Show>
							);
						}}
					</For>
				</div>
			</Show>

			{/* Legend */}
			<div class="chart-legend">
				<For each={props.series}>
					{(series) => (
						<div class="chart-legend-item">
							<span class="chart-legend-dot" style={{ background: series().color }} />
							<span>{series().name}</span>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}

export default function Overview(props: { leaderboard: Leaderboard }) {
	const cumulativePoints = createMemo(() => {
		return props.leaderboard.players.map((player, pi) => {
			let cumulative = 0;
			const points: ChartPoint[] = player.games.map((g, i) => {
				cumulative += Math.max(4 - g.rank, 0);
				return { x: i, y: cumulative, label: `Game ${i + 1}` };
			});
			return {
				name: player.username,
				color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
				points
			};
		});
	});

	const rollingWinRate = createMemo(() => {
		const window = Math.min(10, Math.max(3, Math.floor(props.leaderboard.games / 5)));
		return props.leaderboard.players.map((player, pi) => {
			const points: ChartPoint[] = [];
			for (let i = 0; i < player.games.length; i++) {
				const start = Math.max(0, i - window + 1);
				const slice = player.games.slice(start, i + 1);
				const wins = slice.filter((g) => g.rank === 1).length;
				points.push({
					x: i,
					y: (wins / slice.length) * 100,
					label: `Game ${i + 1}`
				});
			}
			return {
				name: player.username,
				color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
				points
			};
		});
	});

	const vpOverTime = createMemo(() => {
		return props.leaderboard.players.map((player, pi) => {
			const points: ChartPoint[] = player.games.map((g, i) => ({
				x: i,
				y: g.vp,
				label: `Game ${i + 1}`
			}));
			return {
				name: player.username,
				color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
				points
			};
		});
	});

	const durationOverTime = createMemo(() => {
		return props.leaderboard.players.map((player, pi) => {
			const points: ChartPoint[] = player.games
				.filter((g) => g.duration > 0)
				.map((g, i) => ({
					x: i,
					y: g.duration,
					label: `Game ${i + 1}`
				}));
			return {
				name: player.username,
				color: PLAYER_COLORS[pi % PLAYER_COLORS.length],
				points
			};
		});
	});

	return (
		<div class="overview">
			<div class="overview-grid">
				<div class="chart-card">
					<h3 class="chart-title">Cumulative Points</h3>
					<LineChart
						series={cumulativePoints()}
						yLabel="Points"
					/>
				</div>

				<div class="chart-card">
					<h3 class="chart-title">Rolling Win Rate</h3>
					<LineChart
						series={rollingWinRate()}
						yLabel="Win %"
						formatY={(v) => `${Math.round(v)}%`}
					/>
				</div>

				<div class="chart-card">
					<h3 class="chart-title">Victory Points per Game</h3>
					<LineChart
						series={vpOverTime()}
						yLabel="VP"
					/>
				</div>

				<div class="chart-card">
					<h3 class="chart-title">Game Duration</h3>
					<LineChart
						series={durationOverTime()}
						yLabel="Duration"
						formatY={(v) => formatDuration(v)}
					/>
				</div>
			</div>
		</div>
	);
}
