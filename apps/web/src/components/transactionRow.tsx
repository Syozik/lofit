import { cents, formatAmount } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { amountFor, monogram, transactionMeta } from "@lofit/view";
import { Pencil, Trash2 } from "lucide-react";
import { useDesktop } from "../useDesktop";
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

    const desktop = useDesktop();
    const actionable = onDelete !== undefined && onEdit !== undefined;
    const { offset, dragging, hover, revealed, handlers } = useSwipe({
        enabled: actionable,
        actions: 2,
        onTap: desktop ? () => onEdit?.(transaction) : undefined,
    });
    const inline = actionable && hover;

    function actions(tabbable: boolean) {
        return (
            <>
                <button
                    className="row-action"
                    aria-label={`Edit ${transaction.name}`}
                    tabIndex={tabbable ? 0 : -1}
                    onClick={() => onEdit?.(transaction)}
                >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden />
                </button>
                <button
                    className="row-action danger"
                    aria-label={`Delete ${transaction.name}`}
                    tabIndex={tabbable ? 0 : -1}
                    onClick={() => onDelete?.(transaction)}
                >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
            </>
        );
    }

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
            {inline && (
                <span
                    className="row-inline-actions"
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {actions(true)}
                </span>
            )}
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
            {!inline && (
                <div className="row-actions" style={{ width: ACTION_WIDTH * 2 }}>
                    {actions(revealed)}
                </div>
            )}
        </div>
    );
}
