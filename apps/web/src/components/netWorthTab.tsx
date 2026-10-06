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
import type { Delta, RangeKey, Scope } from "@lofit/domain";
import { useState } from "react";
import { monthName } from "../period";
import { centreLabel, kickerFor, netWorthSlices, shortEuros, signedAmount, signedPercent } from "@lofit/view";
import { Donut } from "./donut";
import { useInvestmentTrend } from "../useInvestmentTrend";
import { InvestmentTrend } from "./investmentTrend";
import { RecentTransactions } from "./recentTransactions";
import { TrendChart } from "./trendChart";

type ChartMode = "mix" | "trend";

const CHART_MODES: readonly ChartMode[] = ["mix", "trend"];

const CHART_LABELS: Record<ChartMode, string> = { mix: "Mix", trend: "Trend" };

const MIX_TITLE = "Made of";

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
    const slices = netWorthSlices(scoped, allGroups, selected ? owesMoney(selected.total) : false);

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
