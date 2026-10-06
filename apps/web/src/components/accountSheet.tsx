import { useAddAccount, useAddGroup, useGroups, useUpdateAccountBalance } from "@lofit/api";
import { euros } from "@lofit/domain";
import type { Account } from "@lofit/domain";
import { useState } from "react";
import { Sheet } from "./sheet";

function parseAmount(input: string): number | undefined {
    const typed = input.replace(",", ".").replace(/[\u2212\u2013\u2014]/g, "-");
    const value = Number.parseFloat(typed);
    return Number.isFinite(value) ? value : undefined;
}

function startingAmount(account: Account): string {
    return (account.balance / 100).toFixed(2);
}

type Props = {
    account?: Account;
    onClose: () => void;
    onSaved: (message: string) => void;
};

export function AccountSheet({ account, onClose, onSaved }: Props) {
    const { data: groups } = useGroups();
    const addAccount = useAddAccount();
    const addGroup = useAddGroup();
    const updateBalance = useUpdateAccountBalance();

    const [name, setName] = useState(account?.name ?? "");
    const [subtitle, setSubtitle] = useState(account?.subtitle ?? "");
    const [groupId, setGroupId] = useState(account?.groupId ?? "");
    const [newGroup, setNewGroup] = useState<string | undefined>(undefined);
    const [amount, setAmount] = useState(account ? startingAmount(account) : "");

    const editing = account !== undefined;
    const value = parseAmount(amount);
    const chosen = groupId || groups?.[0]?.id || "";
    const pending = addAccount.isPending || updateBalance.isPending;
    const blocked = pending || value === undefined || (!editing && (!name.trim() || !chosen));

    async function createGroup() {
        const wanted = newGroup?.trim();
        setNewGroup(undefined);
        if (!wanted) return;

        const group = await addGroup.mutateAsync({ name: wanted });
        setGroupId(group.id);
    }

    function save() {
        if (blocked || value === undefined) return;

        const balance = euros(value);

        if (account) {
            updateBalance.mutate(
                { id: account.id, balance },
                {
                    onSuccess: () => {
                        onSaved(`Updated ${account.name}`);
                        onClose();
                    },
                },
            );
            return;
        }

        addAccount.mutate(
            { name: name.trim(), subtitle: subtitle.trim(), groupId: chosen, balance },
            {
                onSuccess: () => {
                    onSaved(`Added ${name.trim()}`);
                    onClose();
                },
            },
        );
    }

    return (
        <Sheet label={editing ? "Update balance" : "Add an account"} onClose={onClose}>
            <div className="sheet-head">
                <h4 className="sheet-title">
                    {editing ? `Update ${account.name}` : "Add an account"}
                </h4>
            </div>
            {!editing && (
                <div className="sheet-tags">
                    <div className="sheet-chips">
                        {(groups ?? []).map((group) => (
                            <button
                                key={group.id}
                                className={`tag sheet-chip ${chosen === group.id ? "selected" : ""}`}
                                onClick={() => setGroupId(group.id)}
                            >
                                {group.name}
                            </button>
                        ))}
                        {newGroup === undefined ? (
                            <button className="tag sheet-chip" onClick={() => setNewGroup("")}>
                                + New group
                            </button>
                        ) : (
                            <span className="sheet-new-group">
                                <input
                                    autoComplete="off"
                                    className="input sheet-new-tag"
                                    autoFocus
                                    placeholder="New group"
                                    value={newGroup}
                                    onChange={(event) => setNewGroup(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void createGroup();
                                        }
                                        if (event.key === "Escape") setNewGroup(undefined);
                                    }}
                                />
                                <button className="btn btn-ghost" onClick={() => void createGroup()}>
                                    Add
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}
            <div className="sheet-amount">
                <span className="sheet-currency">€</span>
                <input
                    autoComplete="off"
                    className="sheet-amount-input"
                    inputMode="text"
                    placeholder="0.00"
                    aria-label="Balance"
                    autoFocus={editing}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                />
            </div>

            <div className="sheet-fields">
                {!editing && (
                    <>
                        <label className="field">
                            <span>Name</span>
                            <input
                                autoComplete="off"
                                className="input"
                                placeholder="Monobank"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>

                        <label className="field">
                            <span>Subtitle</span>
                            <input
                                autoComplete="off"
                                className="input"
                                placeholder="UA•• 4471 · checking"
                                value={subtitle}
                                onChange={(event) => setSubtitle(event.target.value)}
                            />
                        </label>
                    </>
                )}

                <div className="sheet-actions">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary sheet-save"
                        disabled={blocked}
                        onClick={save}
                    >
                        {pending ? "Saving…" : editing ? "Update balance" : "Add account"}
                    </button>
                </div>
            </div>
        </Sheet>
    );
}
