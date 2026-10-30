import { cents, formatAmount, withSymbol } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { amountFor, metaParts, monogram, transactionMeta } from "@lofit/view";
import { Pencil, Trash2 } from "lucide-react";
import { useDesktop } from "../useDesktop";
import { ACTION_WIDTH, useSwipe } from "../useSwipe";

type Props = {
    transaction: Transaction;
    accountNames: Map<string, string>;
    tagNames: Map<string, string>;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
    onTag?: (tagId: string) => void;
    selectedTags?: readonly string[] | undefined;
    viewedFrom?: string;
};

function TaggedMeta({
    transaction,
    accountNames,
    tagNames,
    onTag,
    selectedTags = [],
}: Pick<Props, "transaction" | "accountNames" | "tagNames" | "selectedTags"> & {
    onTag: (tagId: string) => void;
}) {
    const parts = metaParts(transaction, accountNames, tagNames);
    return (
        <span className="recent-meta">
            {parts.lead}
            {" · "}
            {parts.tags.length === 0
                ? parts.kind
                : parts.tags.map((tag) => (
                      <button
                          key={tag.id}
                          className={`row-tag ${selectedTags.includes(tag.id) ? "selected" : ""}`}
                          title={`Show only ${tag.name}`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                              event.stopPropagation();
                              onTag(tag.id);
                          }}
                      >
                          {tag.name}
                      </button>
                  ))}
            {parts.where && ` · ${parts.where}`}
        </span>
    );
}

export function TransactionRow({
    transaction,
    accountNames,
    tagNames,
    onEdit,
    onDelete,
    onTag,
    selectedTags,
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
                {onTag ? (
                    <TaggedMeta
                        transaction={transaction}
                        accountNames={accountNames}
                        tagNames={tagNames}
                        onTag={onTag}
                        selectedTags={selectedTags}
                    />
                ) : (
                    <span className="recent-meta">{transactionMeta(transaction, accountNames, tagNames, viewedFrom)}</span>
                )}
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
                {amount > 0 ? "+" : "−"}
                {withSymbol(formatAmount(cents(amount)))}
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
