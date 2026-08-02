import { useAccounts } from "@lofit/api";
import { Account, addCents, cents, formatAmount, formatEuros, GROUP_ORDER } from "@lofit/domain";
import type { Cents, GroupKey } from "@lofit/domain";
import { useState } from "react";
import { groupColor, OTHER_COLOR, paletteFor } from "../helpers/palette";

type Group = {
    parts: Account[];
    total: Cents;
};

type Groups = Partial<Record<GroupKey, Group>>;

type Labels = {
    title: string;
    kicker?: string;
    center?: string;
};

const GROUP_LABELS: Record<GroupKey, Labels> = {
    all: {
        title: "All",
        kicker: "Net worth",
        center: "Assets",
    },
    cash: { title: "Cash" },
    inv: {
        title: "Investments",
        center: "Invested",
    },
    debt: { title: "Debt" },
};

const getLabel = (key: GroupKey, label: "title" | "kicker" | "center") => {
    return GROUP_LABELS[key][label] ?? GROUP_LABELS[key].title;
};

const SEGMENT_GAP_DEG = 1.6;

function shortEuros(value: Cents): string {
    return `€ ${Math.round(Math.abs(value) / 100).toLocaleString("en-US")}`;
}

type Slice = {
    key: string;
    label: string;
    value: Cents;
    color: string;
};

function toSlices(group: GroupKey, parts: readonly Account[]): Slice[] {
    const { slots, cap } = paletteFor(group);

    const ranked = [...parts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    const shown = new Set(ranked.slice(0, cap).map((account) => account.id));

    const colors = new Map<string, string>();
    for (const account of parts.filter((account) => shown.has(account.id))) {
        colors.set(account.id, group === "all" ? groupColor(account.group) : slots[colors.size]!);
    }

    const slices: Slice[] = ranked
        .filter((account) => shown.has(account.id))
        .map((account) => ({
            key: account.id,
            label: account.name,
            value: account.balance,
            color: colors.get(account.id)!,
        }));

    const tail = ranked.slice(cap);
    if (tail.length > 0) {
        slices.push({
            key: "other",
            label: `Other (${tail.length})`,
            value: tail.reduce((sum, account) => addCents(sum, account.balance), cents(0)),
            color: OTHER_COLOR,
        });
    }

    return slices;
}

function wholeShares(weights: readonly number[]): number[] {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return weights.map(() => 0);

    const exact = weights.map((weight) => (weight / total) * 100);
    const shares = exact.map((value) => Math.floor(value));
    const byRemainder = exact
        .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
        .sort((a, b) => b.remainder - a.remainder);

    let left = 100 - shares.reduce((sum, share) => sum + share, 0);
    for (const { index } of byRemainder) {
        if (left <= 0) break;
        shares[index]! += 1;
        left -= 1;
    }

    return shares;
}

type Segment = Slice & {
    share: number;
    stop: string;
};

function toSegments(slices: readonly Slice[]): Segment[] {
    const weights = slices.map((slice) => Math.abs(slice.value));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return [];

    const shares = wholeShares(weights);
    const segments: Segment[] = [];
    let sweptDeg = 0;

    for (const [index, slice] of slices.entries()) {
        const sweep = (weights[index]! / total) * 360;
        const from = sweptDeg;
        sweptDeg += sweep;
        const gap = slices.length > 1 ? Math.min(SEGMENT_GAP_DEG, sweep / 3) : 0;
        const to = sweptDeg - gap;

        segments.push({
            ...slice,
            share: shares[index]!,
            stop:
                `${slice.color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg, ` +
                `transparent ${to.toFixed(2)}deg ${sweptDeg.toFixed(2)}deg`,
        });
    }

    return segments;
}

export function NetWorthTab() {
    const { data: accounts, isPending, isError } = useAccounts();
    const [selectedGroup, setSelectedGroup] = useState<GroupKey>("all");

    if (isPending) return <div className="tab-content">Loading…</div>;
    if (isError) return <div className="tab-content">Could not load accounts</div>;
    const groups: Groups = {};
    for (const account of accounts) {
        if (!(account.group in groups)) {
            groups[account.group] = { parts: [], total: cents(0) };
        }
        const group = groups[account.group]!;
        group.parts.push(account);
        group.total = addCents(group.total, account.balance);
    }

    groups.all = { parts: [], total: cents(0) };
    for (const group of GROUP_ORDER) {
        if (group !== "all" && groups[group]?.total) {
            groups.all.parts.push(
                new Account({
                    id: group,
                    name: getLabel(group, "title"),
                    subtitle: "",
                    group,
                    balance: groups[group].total,
                    provenance: "derived",
                }),
            );
            groups.all.total = addCents(groups.all.total, groups[group].total);
        }
    }

    const selected = groups[selectedGroup];
    const total = selected?.total ?? cents(0);
    const segments = toSegments(toSlices(selectedGroup, selected?.parts ?? []));

    return (
        <div className="tab-content">
            <div className="home">
                <div className="summary">
                    <div className="groups">
                        {GROUP_ORDER.map((group) => (
                            <button
                                key={group}
                                className={`group-button ${selectedGroup === group ? "active" : ""}`}
                                onClick={() => setSelectedGroup(group)}
                            >
                                {getLabel(group, "title")}
                            </button>
                        ))}
                    </div>
                    <span className="kicker">{getLabel(selectedGroup, "kicker")}</span>
                    <div className="net-worth">
                        <span className="net-worth-currency">{total < 0 ? "−€" : "€"}</span>
                        <span>{formatAmount(total)}</span>
                    </div>
                </div>

                {selected && (
                    <div className="section">
                        <div className="section-head">
                            <span className="kicker">Made of</span>
                        </div>
                        <div className="composition">
                            <div className="donut">
                                <div
                                    className="donut-ring"
                                    style={{
                                        background: `conic-gradient(from -90deg, ${segments.map((s) => s.stop).join(", ")})`,
                                    }}
                                />
                                <div className="donut-hole">
                                    <span className="donut-label">
                                        {getLabel(selectedGroup, "center")}
                                    </span>
                                    <span className="donut-value">{shortEuros(total)}</span>
                                </div>
                            </div>

                            <div className="legend">
                                {segments.map(({ key, label, value, color, share }) => (
                                    <div key={key} className="legend-item">
                                        <div className="legend-head">
                                            <span
                                                className="legend-dot"
                                                style={{ background: color }}
                                            />
                                            <span className="legend-name" title={label}>
                                                {label}
                                            </span>
                                            <span className="legend-share">{share}%</span>
                                        </div>
                                        <span
                                            className={`legend-value ${value < 0 ? "negative" : ""}`}
                                        >
                                            {formatEuros(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
