import {
    useAccounts,
    useDeleteHolding,
    useGroups,
    useHoldings,
    useRefreshPrices,
    useTransactions,
} from "@lofit/api";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
    accountsByGroup,
    ASSET_TYPE_LABELS,
    cents,
    forAccounts,
    formatEuros,
    holdingsFor,
    holdingValue,
    lastSyncedAt,
    netWorth,
    owesMoney,
    portfolioGain,
} from "@lofit/domain";
import type { Account, Cents, Holding, Transaction } from "@lofit/domain";
import {
    accountChangeLabel,
    detailLines,
    formatSync,
    formatUnits,
    gainLabel,
    latestPricing,
    signedPercent,
    signedWholeEuros,
} from "@lofit/view";
import { useState } from "react";
import { useToast } from "../toast";
import { useDesktop } from "../useDesktop";
import { ACTION_WIDTH, useSwipe } from "../useSwipe";
import { AccountDelete } from "./accountDelete";
import { AccountActivity, AccountHistory } from "./accountHistory";
import { AccountSheet } from "./accountSheet";
import { EntrySheet } from "./entrySheet";
import { HoldingSheet } from "./holdingSheet";
import { PortfolioChart } from "./portfolioChart";

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

function AccountSummary({ account, holdings }: { account: Account; holdings: readonly Holding[] }) {
    const worth = netWorth([account], holdings);
    return (
        <>
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
                        {holdings.length} {holdings.length === 1 ? "position" : "positions"} · cash{" "}
                        {formatEuros(account.balance)}
                    </span>
                ) : (
                    account.change && (
                        <span className={`acct-change ${account.change.favourable ? "up" : ""}`}>
                            {accountChangeLabel(account.change)}
                        </span>
                    )
                )}
            </span>
        </>
    );
}

type Line = { label: string; value: string };

function AccountLines({ lines }: { lines: readonly Line[] }) {
    return lines.map((line) => (
        <div key={line.label} className="acct-line">
            <span className="acct-line-label">{line.label}</span>
            <span className={`acct-line-value ${line.value.startsWith("−") ? "negative" : ""}`}>
                {line.value}
            </span>
        </div>
    ));
}

type AccountActionsProps = {
    account: Account;
    onUpdate: () => void;
    onHistory?: () => void;
    onDelete: () => void;
};

function AccountActions({ account, onUpdate, onHistory, onDelete }: AccountActionsProps) {
    return (
        <div className="acct-actions">
            {onHistory && (
                <button className="btn btn-secondary" onClick={onHistory}>
                    History
                </button>
            )}
            <button className="btn btn-secondary" onClick={onUpdate}>
                Update balance
            </button>
            <button
                className="btn btn-secondary acct-delete"
                aria-label={`Delete ${account.name}`}
                onClick={onDelete}
            >
                <Trash2 size={14} strokeWidth={1.5} aria-hidden />
            </button>
        </div>
    );
}

type AccountCardProps = AccountActionsProps & {
    holdings: readonly Holding[];
    open: boolean;
    onToggle: () => void;
    children?: React.ReactNode;
};

function AccountCard({ holdings, open, onToggle, children, ...actions }: AccountCardProps) {
    return (
        <div className={`acct-card ${open ? "open" : ""}`}>
            <button className="acct-row" aria-expanded={open} onClick={onToggle}>
                <AccountSummary account={actions.account} holdings={holdings} />
                <span className="acct-caret">›</span>
            </button>

            {open && children}

            {open && (
                <div className="acct-panel">
                    <div className="acct-divider" />
                    <AccountLines lines={detailLines(actions.account)} />
                    <AccountActions {...actions} />
                </div>
            )}
        </div>
    );
}

function GainLine({ holding }: { holding: Holding }) {
    const gain = gainLabel(holding);
    return <span className={`acct-change ${gain.favourable ? "up" : ""}`}>{gain.text}</span>;
}

type HoldingRowProps = {
    holding: Holding;
    onOpen: () => void;
    onDelete: () => void;
};

function HoldingRow({ holding, onOpen, onDelete }: HoldingRowProps) {
    const { offset, dragging, revealed, handlers } = useSwipe({
        enabled: true,
        actions: 2,
        onTap: onOpen,
    });

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
                    tabIndex={revealed ? 0 : -1}
                    onClick={onOpen}
                >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden />
                </button>
                <button
                    className="row-action danger"
                    aria-label={`Remove ${holding.symbol}`}
                    tabIndex={revealed ? 0 : -1}
                    onClick={onDelete}
                >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        </div>
    );
}

type AccountPickProps = {
    account: Account;
    holdings: readonly Holding[];
    selected: boolean;
    onSelect: () => void;
};

function AccountPick({ account, holdings, selected, onSelect }: AccountPickProps) {
    return (
        <button
            className={`acct-card acct-row acct-pick ${selected ? "selected" : ""}`}
            aria-current={selected ? "true" : undefined}
            onClick={onSelect}
        >
            <AccountSummary account={account} holdings={holdings} />
        </button>
    );
}

function brokerLines(account: Account, holdings: readonly Holding[]): readonly Line[] {
    if (holdings.length === 0) return [];
    const value = holdings.reduce((sum, holding) => sum + holdingValue(holding), 0);
    const gain = portfolioGain(holdings);
    return [
        { label: "Positions", value: formatEuros(cents(value)) },
        { label: "Cash", value: formatEuros(account.balance) },
        ...(gain
            ? [
                  {
                      label: "Gain",
                      value: `${signedWholeEuros(gain.amount)} · ${signedPercent(gain.pct)}`,
                  },
              ]
            : []),
    ];
}

type AccountPaneProps = AccountActionsProps & {
    accounts: readonly Account[];
    groupName: string;
    holdings: readonly Holding[];
    refresh: React.ReactNode;
    onOpenHolding: (holding: Holding) => void;
    onRemoveHolding: (holding: Holding) => void;
    onEditEntry: (transaction: Transaction) => void;
};

function AccountPane({
    accounts,
    groupName,
    holdings,
    refresh,
    onOpenHolding,
    onRemoveHolding,
    onEditEntry,
    ...actions
}: AccountPaneProps) {
    const { account } = actions;
    const worth = netWorth([account], holdings);
    const transactions = useTransactions();
    const entries = forAccounts(transactions.data ?? [], new Set([account.id])).length;
    const stats = [...(account.details ?? []), ...brokerLines(account, holdings)];
    const pricedAt = latestPricing(holdings);
    const meta =
        holdings.length > 0
            ? [pricedAt ? `Priced ${formatSync(pricedAt)}` : "Never priced"]
            : [
                  account.lastSyncedAt && `Last sync ${formatSync(account.lastSyncedAt)}`,
                  account.statedAt && `You updated ${formatSync(account.statedAt)}`,
              ].filter(Boolean);

    return (
        <section className="acct-pane">
            <div className="acct-pane-head">
                <div className="acct-pane-title">
                    <span className="kicker">{groupName}</span>
                    <h2 className="acct-pane-name">{account.name}</h2>
                    <span
                        className={`accounts-total acct-pane-balance ${worth < 0 ? "negative" : ""}`}
                    >
                        {formatEuros(worth)}
                    </span>
                    <span className="acct-pane-meta">{meta.join(" · ")}</span>
                </div>
                <AccountActions {...actions} />
            </div>

            {stats.length > 0 && (
                <div className="panel acct-pane-lines">
                    <AccountLines lines={stats} />
                </div>
            )}

            {holdings.length > 1 && <PortfolioChart holdings={holdings} />}

            {holdings.length > 0 && (
                <div className="section panel acct-positions">
                    <div className="section-head">
                        <span className="kicker">Positions</span>
                        <span className="acct-group-note section-action">{refresh}</span>
                    </div>
                    <div className="acct-list">
                        {holdings.map((holding) => (
                            <HoldingRow
                                key={holding.id}
                                holding={holding}
                                onOpen={() => onOpenHolding(holding)}
                                onDelete={() => onRemoveHolding(holding)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {(entries > 0 || holdings.length === 0) && (
                <div className="section recent-section panel">
                    <div className="section-head">
                        <span className="kicker">Activity</span>
                        {entries > 0 && (
                            <span className="acct-group-note section-action">
                                {entries} {entries === 1 ? "entry" : "entries"}
                            </span>
                        )}
                    </div>
                    <AccountActivity account={account} accounts={accounts} onEdit={onEditEntry} />
                </div>
            )}
        </section>
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
    const [deleting, setDeleting] = useState<Account | null>(null);
    const [adding, setAdding] = useState(false);
    const [position, setPosition] = useState<Holding | null>(null);
    const [entry, setEntry] = useState<Transaction | null>(null);
    const show = useToast();
    const desktop = useDesktop();

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
    const sections = accountsByGroup(accounts, groups);
    const pricedAt = latestPricing(holdings);

    const refreshButton = (
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
    );
    const refreshControl = (
        <>
            {pricedAt ? `priced ${formatSync(pricedAt)}` : "never priced"}
            {refreshButton}
        </>
    );
    const ordered = desktop ? sections.flatMap((section) => section.accounts) : [];
    const selected = ordered.find((account) => account.id === openId) ?? ordered[0];

    return (
        <div className="tab-content">
            <div className="accounts-split">
                <div className="accounts">
                    <div className="accounts-head">
                        {synced && <span className="kicker">Synced {formatSync(synced)}</span>}
                        <span className="accounts-total">
                            {formatEuros(netWorth(accounts, holdings))}
                        </span>
                    </div>

                    {sections.map(({ group, accounts: members }) => {
                        const held = members.flatMap((account) =>
                            holdingsFor(holdings, account.id),
                        );
                        const total = netWorth(members, held);
                        const portfolio = !desktop && held.length > 0;

                        return (
                            <div key={group.id} className="acct-group">
                                <GroupHead name={group.name} total={total} />
                                {portfolio && (
                                    <span className="acct-group-note">{refreshControl}</span>
                                )}
                                <div className="acct-list">
                                    {portfolio && <PortfolioChart holdings={held} />}
                                    {members.map((account) => {
                                        const own = holdingsFor(holdings, account.id);
                                        return desktop ? (
                                            <AccountPick
                                                key={account.id}
                                                account={account}
                                                holdings={own}
                                                selected={selected?.id === account.id}
                                                onSelect={() => setOpenId(account.id)}
                                            />
                                        ) : (
                                            <AccountCard
                                                key={account.id}
                                                account={account}
                                                holdings={own}
                                                open={openId === account.id}
                                                onToggle={() =>
                                                    setOpenId(
                                                        openId === account.id ? null : account.id,
                                                    )
                                                }
                                                onUpdate={() => setEditing(account)}
                                                onHistory={() => setHistory(account)}
                                                onDelete={() => setDeleting(account)}
                                            >
                                                <div className="acct-holdings">
                                                    {own.map((holding) => (
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
                                        );
                                    })}
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

                {selected && (
                    <AccountPane
                        key={selected.id}
                        account={selected}
                        accounts={accounts}
                        groupName={
                            groups.find((group) => group.id === selected.groupId)?.name ?? ""
                        }
                        holdings={holdingsFor(holdings, selected.id)}
                        refresh={refreshButton}
                        onUpdate={() => setEditing(selected)}
                        onDelete={() => setDeleting(selected)}
                        onOpenHolding={setPosition}
                        onRemoveHolding={(holding) => removeHolding.mutate(holding.id)}
                        onEditEntry={setEntry}
                    />
                )}
            </div>

            {adding && <AccountSheet onClose={() => setAdding(false)} onSaved={show} />}

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

            {deleting && (
                <AccountDelete
                    account={deleting}
                    onClose={() => setDeleting(null)}
                    onDeleted={(message) => {
                        setOpenId(null);
                        show(message);
                    }}
                />
            )}

            {history && (
                <AccountHistory
                    account={history}
                    accounts={accounts}
                    onClose={() => setHistory(null)}
                />
            )}

            {editing && (
                <AccountSheet account={editing} onClose={() => setEditing(null)} onSaved={show} />
            )}

            {entry && <EntrySheet entry={entry} onClose={() => setEntry(null)} onSaved={show} />}
        </div>
    );
}
