import {
    useAccounts,
    useDeleteHolding,
    useGroups,
    useHoldings,
    useRefreshPrices,
} from "@lofit/api";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
    accountsByGroup,
    addCents,
    ASSET_TYPE_LABELS,
    byPosition,
    formatEuros,
    holdingGain,
    holdingsFor,
    holdingValue,
    lastSyncedAt,
    netWorth,
    netWorthItems,
    owesMoney,
    sumItems,
} from "@lofit/domain";
import type { Account, AccountChange, Cents, Group, Holding } from "@lofit/domain";
import { useState } from "react";
import { useToast } from "../toast";
import { ACTION_WIDTH, useSwipe } from "../useSwipe";
import { AccountHistory } from "./accountHistory";
import { AccountSheet } from "./accountSheet";
import { HoldingSheet } from "./holdingSheet";
import { PortfolioChart } from "./portfolioChart";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

function sameDay(one: Date, other: Date): boolean {
    return one.toDateString() === other.toDateString();
}

function formatSync(instant: string): string {
    const when = new Date(instant);
    return sameDay(when, new Date())
        ? `today ${timeFormat.format(when)}`
        : dateTimeFormat.format(when).replace(",", "");
}

function formatChange(change: AccountChange): string {
    const rounded = Math.round(Math.abs(change.amount) / 100).toLocaleString("en-US");
    return `${change.amount < 0 ? "−" : "+"}€${rounded} ${change.period}`;
}

function detailLines(account: Account): readonly { label: string; value: string }[] {
    const lines = [...(account.details ?? [])];

    if (account.lastSyncedAt) {
        lines.push({ label: "Last sync", value: formatSync(account.lastSyncedAt) });
    }

    if (account.statedAt) {
        lines.push({ label: "You updated", value: formatSync(account.statedAt) });
    }

    return lines;
}

const shareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const unitFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

function formatUnits(holding: Holding): string {
    const format = holding.type === "crypto" ? unitFormat : shareFormat;
    const each = new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: holding.currency,
    }).format(holding.nativePrice / 100);

    return `${format.format(holding.quantity)} × ${each}`;
}

type GroupHeadProps = {
    name: string;
    total: Cents;
};

function GroupHead({ name, total }: GroupHeadProps) {
    return (
        <div className="acct-group-head">
            <span className={`kicker ${owesMoney(total) ? "" : "accent"}`}>{name}</span>
            <span className="acct-group-total">{formatEuros(total)}</span>
        </div>
    );
}

type AccountCardProps = {
    account: Account;
    holdings: readonly Holding[];
    open: boolean;
    onToggle: () => void;
    onUpdate: () => void;
    onHistory: () => void;
    children?: React.ReactNode;
};

function AccountCard({
    account,
    holdings,
    open,
    onToggle,
    onUpdate,
    onHistory,
    children,
}: AccountCardProps) {
    const positions = sumItems(netWorthItems([], holdings));
    const worth = addCents(account.balance, positions);
    return (
        <div className={`acct-card ${open ? "open" : ""}`}>
            <button className="acct-row" aria-expanded={open} onClick={onToggle}>
                <span className="acct-text">
                    <span className="acct-name">{account.name}</span>
                    <span className="acct-sub">{account.subtitle}</span>
                </span>
                <span className="acct-figures">
                    <span className={`acct-balance ${worth < 0 ? "negative" : ""}`}>
                        {formatEuros(worth)}
                    </span>
                    {holdings.length > 0 ? (
                        <span className="acct-change">
                            {holdings.length} {holdings.length === 1 ? "position" : "positions"} ·
                            cash {formatEuros(account.balance)}
                        </span>
                    ) : (
                        account.change && (
                            <span className={`acct-change ${account.change.favourable ? "up" : ""}`}>
                                {formatChange(account.change)}
                            </span>
                        )
                    )}
                </span>
                <span className="acct-caret">›</span>
            </button>

            {open && children}

            {open && (
                <div className="acct-panel">
                    <div className="acct-divider" />
                    {detailLines(account).map((line) => (
                        <div key={line.label} className="acct-line">
                            <span className="acct-line-label">{line.label}</span>
                            <span
                                className={`acct-line-value ${line.value.startsWith("−") ? "negative" : ""}`}
                            >
                                {line.value}
                            </span>
                        </div>
                    ))}
                    <div className="acct-actions">
                        <button className="btn btn-secondary" onClick={onHistory}>
                            History
                        </button>
                        <button className="btn btn-secondary" onClick={onUpdate}>
                            Update balance
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function GainLine({ holding }: { holding: Holding }) {
    const gain = holdingGain(holding);
    const sign = gain.amount < 0 ? "−" : "+";

    return (
        <span className={`acct-change ${gain.favourable ? "up" : ""}`}>
            {`${sign}€${Math.round(Math.abs(gain.amount) / 100).toLocaleString("en-US")} · ${sign}${Math.abs(gain.pct).toFixed(1)}%`}
        </span>
    );
}

type HoldingRowProps = {
    holding: Holding;
    onOpen: () => void;
    onDelete: () => void;
};

function HoldingRow({ holding, onOpen, onDelete }: HoldingRowProps) {
    const { offset, dragging, handlers } = useSwipe({ enabled: true, actions: 2, onTap: onOpen });

    return (
        <div className={`acct-card txn-swipe ${dragging ? "dragging" : ""}`}>
            <div
                className="acct-row holding-row touchable"
                {...handlers}
                style={{ transform: `translateX(${offset}px)` }}
            >
                <span className="holding-symbol">{holding.symbol}</span>
                <span className="acct-text">
                    <span className="acct-name">{holding.name}</span>
                    <span className="acct-sub">{ASSET_TYPE_LABELS[holding.type]}</span>
                </span>
                <span className="acct-figures">
                    <span className="acct-balance">{formatEuros(holdingValue(holding))}</span>
                    <span className="acct-change">{formatUnits(holding)}</span>
                    {holding.cost > 0 && <GainLine holding={holding} />}
                </span>
            </div>
            <div className="row-actions" style={{ width: ACTION_WIDTH * 2 }}>
                <button
                    className="row-action"
                    aria-label={`Edit ${holding.symbol}`}
                    tabIndex={offset === 0 ? -1 : 0}
                    onClick={onOpen}
                >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden />
                </button>
                <button
                    className="row-action danger"
                    aria-label={`Remove ${holding.symbol}`}
                    tabIndex={offset === 0 ? -1 : 0}
                    onClick={onDelete}
                >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        </div>
    );
}

export function AccountsTab() {
    const accountsQuery = useAccounts();
    const holdingsQuery = useHoldings();
    const groupsQuery = useGroups();
    const removeHolding = useDeleteHolding();
    const refresh = useRefreshPrices();
    const [openId, setOpenId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Account | null>(null);
    const [history, setHistory] = useState<Account | null>(null);
    const [adding, setAdding] = useState(false);
    const [position, setPosition] = useState<Holding | null>(null);
    const show = useToast();

    if (accountsQuery.isPending || holdingsQuery.isPending || groupsQuery.isPending) {
        return <div className="tab-content">Loading…</div>;
    }
    if (accountsQuery.isError || holdingsQuery.isError || groupsQuery.isError) {
        return <div className="tab-content">Could not load accounts</div>;
    }

    const accounts = accountsQuery.data;
    const holdings = holdingsQuery.data;
    const groups = groupsQuery.data;
    const synced = lastSyncedAt(accounts);
    const byGroup = accountsByGroup(accounts, groups);
    const pricedAt = holdings
        .map((holding) => holding.pricedAt)
        .filter((stamp): stamp is string => stamp !== undefined)
        .sort()
        .at(-1);

    return (
        <div className="tab-content">
            <div className="accounts">
                <div className="accounts-head">
                    {synced && <span className="kicker">Synced {formatSync(synced)}</span>}
                    <span className="accounts-total">
                        {formatEuros(netWorth(accounts, holdings))}
                    </span>
                </div>

                {byPosition(groups).map((group: Group) => {
                    const stated = byGroup.find((entry) => entry.group.id === group.id);
                    if (!stated) return null;

                    const held = stated.accounts.flatMap((account) =>
                        holdingsFor(holdings, account.id),
                    );
                    const total = addCents(stated.total, sumItems(netWorthItems([], held)));

                    return (
                        <div key={group.id} className="acct-group">
                            <GroupHead name={group.name} total={total} />
                            {held.length > 0 && (
                                <span className="acct-group-note">
                                    {pricedAt ? `priced ${formatSync(pricedAt)}` : "never priced"}
                                    <button
                                        className="btn btn-ghost acct-refresh"
                                        aria-label="Refresh prices"
                                        disabled={refresh.isPending}
                                        onClick={() =>
                                            refresh.mutate(undefined, {
                                                onSuccess: (report) =>
                                                    show(
                                                        report.missing > 0
                                                            ? `${report.changed} updated, ${report.missing} without a live price`
                                                            : `${report.changed} updated, ${report.confirmed} unchanged`,
                                                    ),
                                            })
                                        }
                                    >
                                        <RefreshCw
                                            size={13}
                                            strokeWidth={1.5}
                                            className={refresh.isPending ? "spinning" : ""}
                                            aria-hidden
                                        />
                                    </button>
                                </span>
                            )}
                            <div className="acct-list">
                                {held.length > 0 && <PortfolioChart holdings={held} />}
                                {stated.accounts.map((account) => (
                                    <AccountCard
                                        key={account.id}
                                        account={account}
                                        holdings={holdingsFor(holdings, account.id)}
                                        open={openId === account.id}
                                        onToggle={() =>
                                            setOpenId(openId === account.id ? null : account.id)
                                        }
                                        onUpdate={() => setEditing(account)}
                                        onHistory={() => setHistory(account)}
                                    >
                                        <div className="acct-holdings">
                                            {holdingsFor(holdings, account.id).map((holding) => (
                                                <HoldingRow
                                                    key={holding.id}
                                                    holding={holding}
                                                    onOpen={() => setPosition(holding)}
                                                    onDelete={() =>
                                                        removeHolding.mutate(holding.id)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </AccountCard>
                                ))}
                            </div>
                        </div>
                    );
                })}

                <button
                    className="btn btn-primary btn-block accounts-connect"
                    onClick={() => setAdding(true)}
                >
                    <Plus size={16} strokeWidth={1.5} aria-hidden />
                    Add an account
                </button>
            </div>

            {adding && (
                <AccountSheet onClose={() => setAdding(false)} onSaved={show} />
            )}

            {position && (
                <HoldingSheet
                    holding={position}
                    accountName={
                        accounts.find((account) => account.id === position.accountId)?.name ?? ""
                    }
                    onClose={() => setPosition(null)}
                    onDone={show}
                />
            )}

            {history && (
                <AccountHistory account={history} accounts={accounts} onClose={() => setHistory(null)} />
            )}

            {editing && (
                <AccountSheet
                    account={editing}
                    onClose={() => setEditing(null)}
                    onSaved={show}
                />
            )}
        </div>
    );
}
