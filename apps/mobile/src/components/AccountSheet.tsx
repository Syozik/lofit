import { useAddAccount, useAddGroup, useGroups, useUpdateAccountBalance } from "@lofit/api";
import { euros } from "@lofit/domain";
import type { Account } from "@lofit/domain";
import { parseAmount } from "@lofit/view";
import { useState } from "react";
import { TextInput } from "react-native";
import { AmountInput } from "./AmountInput";
import { Button } from "./Button";
import { Chip, ChipRow } from "./Choices";
import { Field, fieldStyles } from "./Field";
import { Sheet, SheetActions } from "./Sheet";
import { useToast } from "./Toast";

type Props = {
    account?: Account | undefined;
    onClose: () => void;
};

export function AccountSheet({ account, onClose }: Props) {
    const { data: groups } = useGroups();
    const addAccount = useAddAccount();
    const addGroup = useAddGroup();
    const updateBalance = useUpdateAccountBalance();
    const show = useToast();

    const [name, setName] = useState(account?.name ?? "");
    const [subtitle, setSubtitle] = useState(account?.subtitle ?? "");
    const [groupId, setGroupId] = useState(account?.groupId ?? "");
    const [newGroup, setNewGroup] = useState<string | undefined>(undefined);
    const [amount, setAmount] = useState(account ? (account.balance / 100).toFixed(2) : "");

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
            updateBalance.mutate({ id: account.id, balance });
            show(`Updated ${account.name}`);
        } else {
            addAccount.mutate({ name: name.trim(), subtitle: subtitle.trim(), groupId: chosen, balance });
            show(`Added ${name.trim()}`);
        }
        onClose();
    }

    return (
        <Sheet title={editing ? `Update ${account.name}` : "Add an account"} onClose={onClose}>
            {!editing && (
                <ChipRow>
                    {(groups ?? []).map((group) => (
                        <Chip
                            key={group.id}
                            label={group.name}
                            selected={chosen === group.id}
                            onPress={() => setGroupId(group.id)}
                        />
                    ))}
                    {newGroup === undefined ? (
                        <Chip label="+ New group" onPress={() => setNewGroup("")} />
                    ) : (
                        <TextInput
                            style={[fieldStyles.input, { minWidth: 140, minHeight: 32 }]}
                            autoFocus
                            placeholder="New group"
                            value={newGroup}
                            onChangeText={setNewGroup}
                            onSubmitEditing={() => void createGroup()}
                            onBlur={() => void createGroup()}
                            autoComplete="off"
                        />
                    )}
                </ChipRow>
            )}

            <AmountInput label="Balance" value={amount} onChange={setAmount} autoFocus={editing} />

            {!editing && (
                <>
                    <Field
                        label="Name"
                        placeholder="Monobank"
                        value={name}
                        onChangeText={setName}
                    />
                    <Field
                        label="Subtitle"
                        placeholder="Checking"
                        value={subtitle}
                        onChangeText={setSubtitle}
                    />
                </>
            )}

            <SheetActions>
                <Button variant="secondary" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
                <Button
                    label={pending ? "Saving…" : editing ? "Update balance" : "Add account"}
                    disabled={blocked}
                    onPress={save}
                    style={{ flex: 2 }}
                />
            </SheetActions>
        </Sheet>
    );
}
