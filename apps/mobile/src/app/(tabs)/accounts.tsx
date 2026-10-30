import {
    useAccounts,
    useGroups,
    useHoldings,
    useRefreshPrices,
} from "@lofit/api";
import {
    accountsByGroup,
    addCents,
    ASSET_TYPE_LABELS,
    byPosition,
    formatMoney,
    holdingsFor,
    holdingValue,
    lastSyncedAt,
    netWorth,
    netWorthItems,
    owesMoney,
    sumItems,
} from "@lofit/domain";
import type { Account, Holding } from "@lofit/domain";
import {
    accountChangeLabel,
    inOwnCurrency,
    detailLines,
    formatSync,
    formatUnits,
    gainLabel,
    latestPricing,
} from "@lofit/view";
import { ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountDelete } from "../../components/AccountDelete";
import { AccountHistory } from "../../components/AccountHistory";
import { AccountSheet } from "../../components/AccountSheet";
import { Button } from "../../components/Button";
import { HoldingSheet } from "../../components/HoldingSheet";
import { PortfolioChart } from "../../components/PortfolioChart";
import { Screen, Status, makeText } from "../../components/Screen";
import { useToast } from "../../components/Toast";
import { useOnline } from "../../connectivity";
import type { Colors } from "../../theme";
import { fonts, radius, space, useStyles, useTheme } from "../../theme";

type AccountCardProps = {
    account: Account;
    holdings: readonly Holding[];
    open: boolean;
    onToggle: () => void;
    onUpdate: () => void;
    onHistory: () => void;
    onDelete: () => void;
    children?: ReactNode;
};

function AccountCard({
    account,
    holdings,
    open,
    onToggle,
    onUpdate,
    onHistory,
    onDelete,
    children,
}: AccountCardProps) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const worth = addCents(account.balance, sumItems(netWorthItems([], holdings)));
    const foreign = inOwnCurrency(account);
    const change = account.change ? accountChangeLabel(account.change, account.currency) : undefined;

    return (
        <View style={styles.card}>
            <Pressable
                style={styles.row}
                onPress={onToggle}
                accessibilityState={{ expanded: open }}
            >
                <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                        {account.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                        {account.subtitle}
                    </Text>
                </View>
                <View style={styles.figures}>
                    <Text style={[styles.balance, worth < 0 && styles.negative]}>
                        {foreign && holdings.length === 0
                            ? formatMoney(account.nativeBalance, account.currency)
                            : formatMoney(worth)}
                    </Text>
                    {holdings.length > 0 ? (
                        <Text style={styles.change}>
                            {holdings.length} {holdings.length === 1 ? "position" : "positions"} ·
                            cash {formatMoney(account.nativeBalance, account.currency)}
                        </Text>
                    ) : foreign ? (
                        <Text style={styles.change}>
                            ≈ {formatMoney(account.balance)}
                            {change ? ` · ${change}` : ""}
                        </Text>
                    ) : (
                        change && (
                            <Text style={[styles.change, account.change?.favourable && styles.up]}>{change}</Text>
                        )
                    )}
                </View>
                <ChevronRight
                    size={16}
                    color={colors.subtle}
                    style={open && { transform: [{ rotate: "90deg" }] }}
                />
            </Pressable>

            {open && children}

            {open && (
                <View style={styles.panel}>
                    <View style={styles.divider} />
                    {detailLines(account).map((line) => (
                        <View key={line.label} style={styles.line}>
                            <Text style={styles.lineLabel}>{line.label}</Text>
                            <Text
                                style={[
                                    styles.lineValue,
                                    line.value.startsWith("−") && styles.negative,
                                ]}
                            >
                                {line.value}
                            </Text>
                        </View>
                    ))}
                    <View style={styles.actions}>
                        <Button
                            variant="secondary"
                            label="History"
                            onPress={onHistory}
                            style={styles.action}
                        />
                        <Button
                            variant="secondary"
                            label="Update balance"
                            onPress={onUpdate}
                            style={styles.action}
                        />
                        <Pressable
                            accessibilityLabel={`Delete ${account.name}`}
                            onPress={onDelete}
                            style={styles.delete}
                        >
                            <Trash2 size={14} strokeWidth={1.5} color={colors.danger} />
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

const HoldingRow = memo(function HoldingRow({
    holding,
    onOpen,
}: {
    holding: Holding;
    onOpen: (holding: Holding) => void;
}) {
    const styles = useStyles(makeStyles);
    const gain = holding.cost > 0 ? gainLabel(holding) : undefined;

    return (
        <Pressable
            style={({ pressed }) => [styles.holding, pressed && styles.pressed]}
            onPress={() => onOpen(holding)}
        >
            <Text style={styles.symbol}>{holding.symbol}</Text>
            <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                    {holding.name}
                </Text>
                <Text style={styles.sub}>{ASSET_TYPE_LABELS[holding.type]}</Text>
            </View>
            <View style={styles.figures}>
                <Text style={styles.balance}>{formatMoney(holdingValue(holding))}</Text>
                <Text style={styles.change}>{formatUnits(holding)}</Text>
                {gain && (
                    <Text style={[styles.change, gain.favourable && styles.up]}>
                        {gain.text}
                    </Text>
                )}
            </View>
        </Pressable>
    );
});

export default function AccountsScreen() {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const text = useStyles(makeText);
    const accountsQuery = useAccounts();
    const holdingsQuery = useHoldings();
    const groupsQuery = useGroups();
    const refresh = useRefreshPrices();
    const show = useToast();
    const online = useOnline();

    const [openId, setOpenId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Account | null>(null);
    const [history, setHistory] = useState<Account | null>(null);
    const [deleting, setDeleting] = useState<Account | null>(null);
    const [adding, setAdding] = useState(false);
    const [position, setPosition] = useState<Holding | null>(null);

    const queries = [accountsQuery, holdingsQuery, groupsQuery];
    const refreshing = queries.some((query) => query.isRefetching);
    const reload = () => queries.forEach((query) => void query.refetch());

    if (accountsQuery.isPending || holdingsQuery.isPending || groupsQuery.isPending) {
        return (
            <Screen>
                <Status text="Loading…" busy />
            </Screen>
        );
    }
    if (accountsQuery.isError || holdingsQuery.isError || groupsQuery.isError) {
        return (
            <Screen refreshing={refreshing} onRefresh={reload}>
                <Status text="Could not load accounts. Pull to retry." />
            </Screen>
        );
    }

    const accounts = accountsQuery.data;
    const holdings = holdingsQuery.data;
    const synced = lastSyncedAt(accounts);
    const byGroup = accountsByGroup(accounts, groupsQuery.data);
    const pricedAt = latestPricing(holdings);

    function toggle(id: string) {
        setOpenId(openId === id ? null : id);
    }

    function refreshPrices() {
        refresh.mutate(undefined, {
            onSuccess: (report) =>
                show(
                    report.missing > 0
                        ? `${report.changed} updated, ${report.missing} without a live price`
                        : `${report.changed} updated, ${report.confirmed} unchanged`,
                ),
        });
    }

    return (
        <Screen refreshing={refreshing} onRefresh={reload}>
            <View style={styles.head}>
                {synced && <Text style={text.kicker}>Synced {formatSync(synced)}</Text>}
                <Text style={styles.total}>{formatMoney(netWorth(accounts, holdings))}</Text>
            </View>

            {byPosition(groupsQuery.data).map((group) => {
                const stated = byGroup.find((entry) => entry.group.id === group.id);
                if (!stated) return null;

                const held = stated.accounts.flatMap((account) =>
                    holdingsFor(holdings, account.id),
                );
                const total = addCents(stated.total, sumItems(netWorthItems([], held)));

                return (
                    <View key={group.id} style={styles.group}>
                        <View style={styles.groupHead}>
                            <Text style={[text.kicker, !owesMoney(total) && styles.accent]}>
                                {group.name}
                            </Text>
                            <Text style={styles.groupTotal}>{formatMoney(total)}</Text>
                        </View>
                        {held.length > 0 && (
                            <View style={styles.note}>
                                <Text style={styles.noteText}>
                                    {pricedAt ? `priced ${formatSync(pricedAt)}` : "never priced"}
                                </Text>
                                <Pressable
                                    accessibilityLabel="Refresh prices"
                                    hitSlop={10}
                                    disabled={refresh.isPending || !online}
                                    onPress={refreshPrices}
                                    style={(refresh.isPending || !online) && styles.dim}
                                >
                                    <RefreshCw size={13} strokeWidth={1.5} color={colors.quiet} />
                                </Pressable>
                            </View>
                        )}
                        <View style={styles.list}>
                            {held.length > 0 && <PortfolioChart holdings={held} />}
                            {stated.accounts.map((account) => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    holdings={holdingsFor(holdings, account.id)}
                                    open={openId === account.id}
                                    onToggle={() => toggle(account.id)}
                                    onUpdate={() => setEditing(account)}
                                    onHistory={() => setHistory(account)}
                                    onDelete={() => setDeleting(account)}
                                >
                                    <View style={styles.holdings}>
                                        {holdingsFor(holdings, account.id).map((holding) => (
                                            <HoldingRow
                                                key={holding.id}
                                                holding={holding}
                                                onOpen={setPosition}
                                            />
                                        ))}
                                    </View>
                                </AccountCard>
                            ))}
                        </View>
                    </View>
                );
            })}

            <Button
                label="Add an account"
                icon={<Plus size={16} strokeWidth={1.5} color={colors.onAccent} />}
                onPress={() => setAdding(true)}
            />

            {adding && <AccountSheet onClose={() => setAdding(false)} />}
            {editing && <AccountSheet account={editing} onClose={() => setEditing(null)} />}
            {history && (
                <AccountHistory
                    account={history}
                    accounts={accounts}
                    onClose={() => setHistory(null)}
                />
            )}
            {deleting && (
                <AccountDelete
                    account={deleting}
                    onClose={() => setDeleting(null)}
                    onDeleted={() => setOpenId(null)}
                />
            )}
            {position && (
                <HoldingSheet
                    holding={position}
                    accountName={
                        accounts.find((account) => account.id === position.accountId)?.name ?? ""
                    }
                    onClose={() => setPosition(null)}
                />
            )}
        </Screen>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        head: { gap: 4 },
        total: {
            fontFamily: fonts.medium,
            fontSize: 32,
            letterSpacing: -0.8,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        group: { gap: space[3] },
        groupHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
        accent: { color: colors.accent },
        groupTotal: {
            marginLeft: "auto",
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.quiet,
            fontVariant: ["tabular-nums"],
        },
        note: { flexDirection: "row", alignItems: "center", gap: 6 },
        noteText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
        dim: { opacity: 0.4 },
        list: { gap: space[2] },
        card: {
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.divider,
            overflow: "hidden",
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 13,
            paddingHorizontal: 14,
        },
        rowText: { flex: 1, minWidth: 0 },
        name: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        sub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
        figures: { alignItems: "flex-end" },
        balance: {
            fontFamily: fonts.regular,
            fontSize: 15,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        negative: { color: colors.quiet },
        change: {
            fontFamily: fonts.regular,
            fontSize: 11,
            color: colors.muted,
            fontVariant: ["tabular-nums"],
        },
        up: { color: colors.accentStrong },
        holdings: {
            marginLeft: 10,
            marginTop: 4,
            marginBottom: 2,
            paddingLeft: 6,
            borderLeftWidth: 2,
            borderLeftColor: colors.chip,
            gap: space[1],
        },
        pressed: { opacity: 0.6 },
        holding: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 9,
            paddingRight: 16,
        },
        symbol: {
            minWidth: 46,
            paddingVertical: 3,
            paddingHorizontal: 7,
            borderRadius: radius.sm,
            backgroundColor: colors.accentTint,
            color: colors.accent,
            fontFamily: fonts.medium,
            fontSize: 11,
            letterSpacing: 0.3,
            textAlign: "center",
        },
        panel: { paddingHorizontal: 14, paddingBottom: 14, gap: space[3] },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
        line: { flexDirection: "row", alignItems: "center", gap: 10 },
        lineLabel: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.quiet },
        lineValue: {
            marginLeft: "auto",
            fontFamily: fonts.regular,
            fontSize: 12.5,
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        actions: { flexDirection: "row", gap: 8, marginTop: 2 },
        action: { flex: 1, minHeight: 36, paddingHorizontal: 8 },
        delete: {
            width: 38,
            minHeight: 36,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.dangerEdge,
        },
    });
