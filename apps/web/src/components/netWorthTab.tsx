import { useAccounts, useGroups, useHoldings, useSnapshots } from "@lofit/api";
import {
    addCents,
    ALL_GROUPS,
    ALL_GROUPS_LABEL,
    cents,
    deltaAt,
    formatAmount,
    inRange,
    itemsInScope,
    netWorthGroups,
    netWorthItems,
    owesMoney,
    RANGE_LABELS,
    RANGE_ORDER,
    seriesFor,
} from "@lofit/domain";
import type { Cents, Delta, Group, NetWorthGroup, NetWorthItem, RangeKey, Scope } from "@lofit/domain";
import { useState } from "react";
import { groupColor, OTHER_COLOR, paletteFor } from "../helpers/palette";
import { monthName } from "../period";
import { Donut } from "./donut";
import type { Slice } from "./donut";
import { useInvestmentTrend } from "../useInvestmentTrend";
import { InvestmentTrend } from "./investmentTrend";
import { RecentTransactions } from "./recentTransactions";
import { TrendChart } from "./trendChart";

function kickerFor(entry: NetWorthGroup | undefined): string {
    if (!entry) return "Net worth";
    return owesMoney(entry.total) ? `${entry.group.name} outstanding` : entry.group.name;
}

function centreLabel(entry: NetWorthGroup | undefined): string {
    return entry ? entry.group.name : "Assets";
}

type ChartMode = "mix" | "trend";

const CHART_MODES: readonly ChartMode[] = ["mix", "trend"];

const CHART_LABELS: Record<ChartMode, string> = { mix: "Mix", trend: "Trend" };

const MIX_TITLE = "Made of";

function shortEuros(value: Cents): string {
    return `€ ${Math.round(Math.abs(value) / 100).toLocaleString("en-US")}`;
}

function signedAmount(value: Cents): string {
    return `${value < 0 ? "−" : "+"} € ${formatAmount(value)}`;
}

function signedPercent(value: number): string {
    return `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}%`;
}

function toSlices(
    parts: readonly NetWorthItem[],
    groups: readonly Group[],
    owed: boolean,
): Slice[] {
    const { slots, cap } = paletteFor(owed);
    const positionOf = (groupId: string) =>
        groups.find((group) => group.id === groupId)?.position ?? 0;

    const ranked = [...parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const shown = new Set(ranked.slice(0, cap).map((item) => item.id));

    const colors = new Map<string, string>();
    for (const item of parts.filter((item) => shown.has(item.id))) {
        colors.set(
            item.id,
            item.id === item.groupId
                ? groupColor(positionOf(item.groupId), item.value < 0)
                : slots[colors.size % slots.length]!,
        );
    }

    const slices: Slice[] = ranked
        .filter((item) => shown.has(item.id))
        .map((item) => ({
            key: item.id,
            label: item.label,
            value: item.value,
            color: colors.get(item.id)!,
        }));

    const tail = ranked.slice(cap);
    const only = tail.length === 1 ? tail[0] : undefined;

    if (only) {
        slices.push({ key: only.id, label: only.label, value: only.value, color: OTHER_COLOR });
    } else if (tail.length > 1) {
        slices.push({
            key: "other",
            label: `Other (${tail.length})`,
            value: tail.reduce((sum, item) => addCents(sum, item.value), cents(0)),
            color: OTHER_COLOR,
        });
    }

    return slices;
}

function DeltaLine({ delta, previous }: { delta: Delta; previous: string }) {
    return (
        <div className={`delta ${delta.favourable ? "up" : ""}`}>
            <span className="delta-amount">{signedAmount(delta.amount)}</span>
            <span className="delta-pct">{signedPercent(delta.pct)}</span>
            <span className="delta-vs">vs {previous}</span>
        </div>
    );
}

export function NetWorthTab() {
    const accounts = useAccounts();
    const holdings = useHoldings();
    const snapshots = useSnapshots();
    const groupRows = useGroups();

    const [scope, setScope] = useState<Scope>(ALL_GROUPS);
    const [mode, setMode] = useState<ChartMode>("mix");
    const [range, setRange] = useState<RangeKey>("1y");
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [focusedSlice, setFocusedSlice] = useState<string | null>(null);

    const allMonths = snapshots.data ?? [];
    const months = inRange(allMonths, range);
    const focusIndex = (mode === "trend" ? selectedIndex : null) ?? months.length - 1;
    const offset = allMonths.length - months.length;

    const investingScope =
        mode === "trend"
            ? groupRows.data?.find((group) => group.id === scope && group.invests)?.id
            : undefined;
    const investments = useInvestmentTrend(investingScope);

    if (accounts.isPending || holdings.isPending || snapshots.isPending || groupRows.isPending) {
        return <div className="tab-content">Loading…</div>;
    }
    if (accounts.isError || holdings.isError || snapshots.isError || groupRows.isError) {
        return <div className="tab-content">Could not load accounts</div>;
    }

    const allGroups = groupRows.data;
    const groups = netWorthGroups(netWorthItems(accounts.data, holdings.data), allGroups);
    const selected = groups.find((entry) => entry.group.id === scope);
    const scoped = itemsInScope(groups, scope);
    const live = scoped.reduce((sum, item) => addCents(sum, item.value), cents(0));
    const slices = toSlices(scoped, allGroups, selected ? owesMoney(selected.total) : false);

    const fullSeries = seriesFor(allMonths, scope);
    const series = fullSeries.slice(offset);
    const previous = allMonths[offset + focusIndex - 1]?.period;
    const delta = investments.active ? investments.delta : deltaAt(fullSeries, offset + focusIndex);
    const since = investments.active ? investments.since : previous ? monthName(previous, "long") : "start";
    const total = investments.active
        ? (investments.shown?.value ?? live)
        : ((mode === "trend" ? series[focusIndex] : undefined) ?? live);

    const kicker = kickerFor(selected);

    const snapshot = months[focusIndex];
    const liveAssets = groups
        .filter((entry) => !owesMoney(entry.total))
        .reduce((sum, entry) => addCents(sum, entry.total), cents(0));
    const ownedThatMonth = snapshot
        ? snapshot.groups
              .filter((entry) => entry.amount > 0)
              .reduce((sum, entry) => addCents(sum, entry.amount), cents(0))
        : cents(0);
    const centre =
        scope !== ALL_GROUPS
            ? total
            : mode === "trend" && snapshot
              ? ownedThatMonth
              : liveAssets;

    return (
        <div className="tab-content">
            <div className="home">
                <div className="summary">
                    <div className="groups">
                        <button
                            className={`group-button ${scope === ALL_GROUPS ? "active" : ""}`}
                            onClick={() => {
                                setScope(ALL_GROUPS);
                                setFocusedSlice(null);
                            }}
                        >
                            {ALL_GROUPS_LABEL}
                        </button>
                        {allGroups.map((group) => (
                            <button
                                key={group.id}
                                className={`group-button ${scope === group.id ? "active" : ""}`}
                                onClick={() => {
                                    setScope(group.id);
                                    setFocusedSlice(null);
                                }}
                            >
                                {group.name}
                            </button>
                        ))}
                    </div>
                    <span className="kicker">{kicker}</span>
                    <div className="net-worth">
                        <span className="net-worth-currency">{total < 0 ? "−€" : "€"}</span>
                        <span>{formatAmount(total)}</span>
                    </div>
                    {delta && <DeltaLine delta={delta} previous={since} />}
                </div>

                {scoped.length > 0 && (
                    <div className="section">
                        <div className="chart-head">
                            {investments.active ? (
                                <span className="kicker">{investments.focusLabel}</span>
                            ) : mode === "trend" ? (
                                <div className="ranges">
                                    {RANGE_ORDER.map((option) => (
                                        <button
                                            key={option}
                                            className={`tag range-chip ${range === option ? "selected" : ""}`}
                                            onClick={() => {
                                                setRange(option);
                                                setSelectedIndex(null);
                                            }}
                                        >
                                            {RANGE_LABELS[option]}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <span className="kicker">{MIX_TITLE}</span>
                            )}
                            <div className="seg chart-modes">
                                {CHART_MODES.map((option) => (
                                    <label key={option} className="seg-opt">
                                        <input
                                            type="radio"
                                            name="chart-mode"
                                            checked={mode === option}
                                            onChange={() => setMode(option)}
                                        />
                                        {CHART_LABELS[option]}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {investments.active ? (
                            <InvestmentTrend trend={investments} />
                        ) : mode === "trend" ? (
                            <TrendChart
                                snapshots={months}
                                groups={allGroups}
                                series={series}
                                selectedIndex={focusIndex}
                                onSelect={setSelectedIndex}
                            />
                        ) : (
                            <Donut
                                slices={slices}
                                focused={focusedSlice}
                                onFocus={setFocusedSlice}
                                label={centreLabel(selected)}
                                value={shortEuros(centre)}
                                scoped={scope !== ALL_GROUPS}
                            />
                        )}
                    </div>
                )}

                <RecentTransactions accounts={accounts.data} scope={scope} />
            </div>
        </div>
    );
}
