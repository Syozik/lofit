import { cents, defaultCustom, PORTFOLIO_RANGES, pointsWithin, rangeWindow, snapshotPoints } from "@lofit/domain";
import type { Cents, Delta, DayWindow, HistoryRange, Scope, Snapshot } from "@lofit/domain";
import { usePortfolioHistory } from "./usePortfolioHistory";

export type TrendSelection = {
    range: HistoryRange;
    custom: DayWindow | null;
    hover: number | null;
};

export const INITIAL_TREND: TrendSelection = { range: "1m", custom: null, hover: null };

type SelectionState = readonly [TrendSelection, (update: (current: TrendSelection) => TrendSelection) => void];

export type TrendPoint = {
    at: string;
    value: Cents;
    invested?: Cents;
};

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const timeFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function endingLive(points: readonly TrendPoint[], today: string, live: Cents): TrendPoint[] {
    return [...points.filter((point) => point.at < today), { at: today, value: live }];
}

export function useNetWorthTrend(
    scope: Scope,
    investing: string | undefined,
    snapshots: readonly Snapshot[],
    live: Cents,
    [{ range, custom, hover }, select]: SelectionState,
) {
    const setHover = (next: number | null) => select((current) => ({ ...current, hover: next }));

    const today = new Date().toISOString().slice(0, 10);
    const daily = usePortfolioHistory(investing, false);
    const portfolio = investing !== undefined && (daily.isPending || (daily.data?.length ?? 0) > 1);
    const history: readonly TrendPoint[] = portfolio
        ? (daily.data ?? [])
        : endingLive(snapshotPoints(snapshots, scope), today, live);
    const bounds = { from: history[0]?.at ?? "", to: history[history.length - 1]?.at ?? "" };

    const ranges = PORTFOLIO_RANGES.filter(
        (option) =>
            (option === "1d" && portfolio) ||
            option === "max" ||
            option === "custom" ||
            (option !== "1d" && bounds.to !== "" && (rangeWindow(option, bounds.to).from ?? "") > bounds.from),
    );
    const active = ranges.includes(range) ? range : "max";
    const intraday = active === "1d";
    const ticks = usePortfolioHistory(intraday ? investing : undefined, true);

    const window = custom ?? (bounds.to ? defaultCustom(bounds.from, bounds.to) : bounds);
    const source: readonly TrendPoint[] = intraday ? (ticks.data ?? []) : history;
    const points = intraday || !bounds.to ? source : pointsWithin(source, (point) => point.at, rangeWindow(active, bounds.to, { custom: window }));

    const first = points[0];
    const last = points[points.length - 1];
    const focus = hover === null ? undefined : points[hover];
    const shown = focus ?? last;

    const delta: Delta | undefined =
        first && shown
            ? {
                  amount: cents(shown.value - first.value),
                  pct: first.value === 0 ? 0 : ((shown.value - first.value) / Math.abs(first.value)) * 100,
                  favourable: shown.value >= first.value,
              }
            : undefined;

    const label = (point: TrendPoint) =>
        intraday ? timeFormat.format(new Date(point.at)) : dayFormat.format(new Date(point.at));

    return {
        pending: portfolio && (daily.isPending || (intraday && ticks.isPending)),
        failed: portfolio && (daily.isError || (intraday && ticks.isError)),
        points,
        shown,
        delta,
        since: first ? (intraday ? "24h ago" : label(first)) : "start",
        focusLabel: focus ? label(focus) : undefined,
        focusSnapshot:
            focus && !intraday && focus.at < today ? snapshots.find((snapshot) => snapshot.day === focus.at) : undefined,
        hover,
        setHover,
        ranges,
        range: active,
        selectRange: (option: HistoryRange) => select((current) => ({ ...current, range: option, hover: null })),
        custom: window,
        setCustom: (next: DayWindow) => select((current) => ({ ...current, custom: next, hover: null })),
        bounds,
    };
}

export type NetWorthTrendState = ReturnType<typeof useNetWorthTrend>;
