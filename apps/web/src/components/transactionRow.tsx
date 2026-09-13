import { formatAmount, KIND_LABELS } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { Pencil, Trash2 } from "lucide-react";
import { ACTION_WIDTH, useSwipe } from "../useSwipe";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
});

function metaLine(
    transaction: Transaction,
    accountNames: Map<string, string>,
    tagNames: Map<string, string>,
): string {
    const labels = transaction.tagIds.map((id) => tagNames.get(id) ?? "Unknown tag");
    const what = labels.length > 0 ? labels.join(" · ") : KIND_LABELS[transaction.kind];

    const from = accountNames.get(transaction.accountId) ?? "Unknown account";
    const to = transaction.toAccountId ? accountNames.get(transaction.toAccountId) : undefined;
    const where = to ? `${from} → ${to}` : from;

    return `${dayFormat.format(new Date(transaction.occurredAt))} · ${what} · ${where}`;
}

type Props = {
    transaction: Transaction;
    accountNames: Map<string, string>;
    tagNames: Map<string, string>;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
};

export function TransactionRow({
    transaction,
    accountNames,
    tagNames,
    onEdit,
    onDelete,
}: Props) {
    const actionable = onDelete !== undefined && onEdit !== undefined;
    const { offset, dragging, handlers } = useSwipe({ enabled: actionable, actions: 2 });

    const row = (
        <div
            className={`recent-row ${actionable ? "touchable" : ""}`}
            {...handlers}
            style={actionable ? { transform: `translateX(${offset}px)` } : undefined}
        >
            <span className="recent-mono">{transaction.name.trim().charAt(0).toUpperCase()}</span>
            <span className="recent-text">
                <span className="recent-name" title={transaction.name}>
                    {transaction.name}
                </span>
                <span className="recent-meta">{metaLine(transaction, accountNames, tagNames)}</span>
            </span>
            <span className={`recent-amount ${transaction.amount > 0 ? "positive" : ""}`}>
                {transaction.amount > 0 ? "+ € " : "− € "}
                {formatAmount(transaction.amount)}
            </span>
        </div>
    );

    if (!actionable) return row;

    return (
        <div className={`txn-swipe ${dragging ? "dragging" : ""}`}>
            {row}
            <div className="row-actions" style={{ width: ACTION_WIDTH * 2 }}>
                <button
                    className="row-action"
                    aria-label={`Edit ${transaction.name}`}
                    tabIndex={offset === 0 ? -1 : 0}
                    onClick={() => onEdit(transaction)}
                >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden />
                </button>
                <button
                    className="row-action danger"
                    aria-label={`Delete ${transaction.name}`}
                    tabIndex={offset === 0 ? -1 : 0}
                    onClick={() => onDelete(transaction)}
                >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
            </div>
        </div>
    );
}
