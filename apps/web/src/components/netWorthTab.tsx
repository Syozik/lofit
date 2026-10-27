import { INITIAL_TREND, useAccounts, useGroups, useHoldings, useNetWorthTrend, useSnapshots } from "@lofit/api";
import {
    addCents,
    ALL_GROUPS,
    ALL_GROUPS_LABEL,
    amountIn,
    byPosition,
    cents,
    formatAmount,
    itemsInScope,
    netWorthGroups,
    netWorthItems,
    owesMoney,
} from "@lofit/domain";
import type { Account, Delta, Group, Holding, Scope, Snapshot } from "@lofit/domain";
import { useState } from "react";
import {
    centreLabel,
    groupColor,
    kickerFor,
    netWorthSlices,
    shortEuros,
    signedAmount,
    signedPercent,
} from "@lofit/view";
import { cssColor } from "../helpers/palette";
import { Donut } from "./donut";
import { useDesktop } from "../useDesktop";
import { NetWorthRanges, NetWorthTrend } from "./netWorthTrend";
import type { TrendPart } from "./netWorthTrend";
import { RecentTransactions } from "./recentTransactions";

type ChartMode = "mix" | "trend";

const CHART_MODES: readonly ChartMode[] = ["mix", "trend"];

const CHART_LABELS: Record<ChartMode, string> = { mix: "Mix", trend: "Trend" };

const MIX_TITLE = "Made of";

const TREND_TITLE = "Trend";

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

    if (accounts.isPending || holdings.isPending || snapshots.isPending || groupRows.isPending) {
        return <div className="tab-content">Loading…</div>;
    }
    if (accounts.isError || holdings.isError || snapshots.isError || groupRows.isError) {
        return <div className="tab-content">Could not load accounts</div>;
    }

    return (
        <NetWorthPage
            accounts={accounts.data}
            holdings={holdings.data}
            snapshots={snapshots.data}
            allGroups={groupRows.data}
        />
    );
}

type PageProps = {
    accounts: readonly Account[];
    holdings: readonly Holding[];
    snapshots: readonly Snapshot[];
    allGroups: readonly Group[];
};

function NetWorthPage({ accounts, holdings, snapshots, allGroups }: PageProps) {
    const [scope, setScope] = useState<Scope>(ALL_GROUPS);
    const [mode, setMode] = useState<ChartMode>("mix");
    const [focusedSlice, setFocusedSlice] = useState<string | null>(null);
    const desktop = useDesktop();

    const groups = netWorthGroups(netWorthItems(accounts, holdings), allGroups);
    const selected = groups.find((entry) => entry.group.id === scope);
    const scoped = itemsInScope(groups, scope);
    const live = scoped.reduce((sum, item) => addCents(sum, item.value), cents(0));
    const slices = netWorthSlices(scoped, allGroups, selected ? owesMoney(selected.total) : false);

    const investing = allGroups.find((group) => group.id === scope && group.invests)?.id;
    const trend = useNetWorthTrend(scope, investing, snapshots, live, useState(INITIAL_TREND));
    const total = trend.shown?.value ?? live;
    const kicker = trend.focusLabel ? `${kickerFor(selected)} · ${trend.focusLabel}` : kickerFor(selected);

    const past = trend.focusSnapshot;
    const parts: TrendPart[] =
        scope === ALL_GROUPS
            ? byPosition(allGroups)
                  .map((group) => ({
                      group,
                      value: past
                          ? amountIn(past, group.id)
                          : (groups.find((entry) => entry.group.id === group.id)?.total ?? cents(0)),
                  }))
                  .filter((entry) => entry.value !== 0)
                  .map(({ group, value }) => ({
                      id: group.id,
                      label: group.name,
                      value,
                      color: cssColor(groupColor(group.position, value < 0)),
                  }))
            : [];

    const liveAssets = groups
        .filter((entry) => !owesMoney(entry.total))
        .reduce((sum, entry) => addCents(sum, entry.total), cents(0));
    const centre = scope !== ALL_GROUPS ? live : liveAssets;

    const chart = <NetWorthTrend trend={trend} parts={parts} ranges={!desktop} />;

    const mix = (
        <Donut
            slices={slices}
            focused={focusedSlice}
            onFocus={setFocusedSlice}
            label={centreLabel(selected)}
            value={shortEuros(centre)}
            scoped={scope !== ALL_GROUPS}
        />
    );

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
                    {trend.delta && <DeltaLine delta={trend.delta} previous={trend.since} />}
                </div>

                {scoped.length > 0 &&
                    (desktop ? (
                        <div className="nw-charts">
                            <div className="section panel nw-trend">
                                <div className="chart-head">
                                    <span className="kicker">{TREND_TITLE}</span>
                                    <NetWorthRanges trend={trend} />
                                </div>
                                {chart}
                            </div>
                            <div className="section panel nw-mix">
                                <span className="kicker">{MIX_TITLE}</span>
                                {mix}
                            </div>
                        </div>
                    ) : (
                        <div className="section">
                            <div className="chart-head">
                                <span className="kicker">{mode === "trend" ? TREND_TITLE : MIX_TITLE}</span>
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
                            {mode === "trend" ? chart : mix}
                        </div>
                    ))}

                <RecentTransactions accounts={accounts} scope={scope} />
            </div>
        </div>
    );
}
