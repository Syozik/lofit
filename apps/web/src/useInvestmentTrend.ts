import { usePortfolioHistory } from "@lofit/api";
import { cents, PORTFOLIO_RANGES, pointsWithin, rangeWindow } from "@lofit/domain";
import type { Delta, DayWindow, HistoryRange, ValuePoint } from "@lofit/domain";
import { useState } from "react";
import { defaultCustom } from "@lofit/view";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const timeFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function useInvestmentTrend(groupId: string | undefined) {
    const [range, setRange] = useState<HistoryRange>("1m");
    const [custom, setCustom] = useState<DayWindow | null>(null);
    const [hover, setHover] = useState<number | null>(null);

    const daily = usePortfolioHistory(groupId, false);
    const history = daily.data ?? [];
    const bounds = { from: history[0]?.at ?? "", to: history[history.length - 1]?.at ?? "" };

    const ranges = PORTFOLIO_RANGES.filter(
        (option) =>
            option === "1d" ||
            option === "max" ||
            option === "custom" ||
            (bounds.to !== "" && (rangeWindow(option, bounds.to).from ?? "") > bounds.from),
    );
    const active = ranges.includes(range) ? range : "max";
    const intraday = active === "1d";
    const ticks = usePortfolioHistory(intraday ? groupId : undefined, true);

    const window = custom ?? (bounds.to ? defaultCustom(bounds.from, bounds.to) : bounds);
    const source = intraday ? (ticks.data ?? []) : history;
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

    const label = (point: ValuePoint) =>
        intraday ? timeFormat.format(new Date(point.at)) : dayFormat.format(new Date(point.at));

    return {
        active: groupId !== undefined && (daily.isPending || history.length > 0),
        pending: daily.isPending || (intraday && ticks.isPending),
        failed: daily.isError || (intraday && ticks.isError),
        points,
        shown,
        delta,
        since: first ? (intraday ? "24h ago" : label(first)) : "start",
        focusLabel: focus ? label(focus) : "Now",
        hover,
        setHover,
        ranges,
        range: active,
        selectRange: (option: HistoryRange) => {
            setRange(option);
            setHover(null);
        },
        custom: window,
        setCustom: (next: DayWindow) => {
            setCustom(next);
            setHover(null);
        },
        bounds,
    };
}

export type InvestmentTrendState = ReturnType<typeof useInvestmentTrend>;
