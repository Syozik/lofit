import { cents, formatAmount } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { amountFor, monogram, transactionMeta } from "@lofit/view";
import { Pencil, Trash2 } from "lucide-react";
import { ACTION_WIDTH, useSwipe } from "../useSwipe";

type Props = {
    transaction: Transaction;
    accountNames: Map<string, string>;
    tagNames: Map<string, string>;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
    viewedFrom?: string;
};

export function TransactionRow({
    transaction,
    accountNames,
    tagNames,
    onEdit,
    onDelete,
    viewedFrom,
}: Props) {
    const amount = amountFor(transaction, viewedFrom);

    const actionable = onDelete !== undefined && onEdit !== undefined;
    const { offset, dragging, handlers } = useSwipe({ enabled: actionable, actions: 2 });

    const row = (
        <div
            className={`recent-row ${actionable ? "touchable" : ""}`}
            {...handlers}
            style={actionable ? { transform: `translateX(${offset}px)` } : undefined}
        >
            <span className="recent-mono">{monogram(transaction)}</span>
            <span className="recent-text">
                <span className="recent-name" title={transaction.name}>
                    {transaction.name}
                </span>
                <span className="recent-meta">{transactionMeta(transaction, accountNames, tagNames, viewedFrom)}</span>
            </span>
            <span className={`recent-amount ${amount > 0 ? "positive" : ""}`}>
                {amount > 0 ? "+ € " : "− € "}
                {formatAmount(cents(amount))}
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
