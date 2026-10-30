import {
    changePassword,
    deleteUser,
    useDisplayCurrency,
    useRecurring,
    useRemoveRecurring,
    useUpdateRecurring,
    useUpdateSettings,
} from "@lofit/api";
import { cadenceLabel, euros, formatAmount, withSymbol } from "@lofit/domain";
import type { Recurring } from "@lofit/domain";
import { dayFormat, parsePositive } from "@lofit/view";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ThemePreference } from "../theme";
import { setThemePreference, useThemePreference } from "../theme";
import { CurrencySelect } from "./currencySelect";
import { Sheet } from "./sheet";

const MIN_PASSWORD = 8;

const THEMES: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

function ChangePassword({ onSaved }: { onSaved: (message: string) => void }) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const short = next.length > 0 && next.length < MIN_PASSWORD;
    const blocked = pending || !current || next.length < MIN_PASSWORD;

    async function savePassword() {
        if (blocked) return;
        setPending(true);
        setError(null);
        try {
            await changePassword(current, next);
            close();
            onSaved("Password changed");
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }

    function close() {
        setOpen(false);
        setCurrent("");
        setNext("");
        setError(null);
    }

    if (!open) {
        return (
            <div className="settings-password settings-row">
                <div className="settings-row-text">
                    <span>Password</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setOpen(true)}>
                    Change
                </button>
            </div>
        );
    }

    return (
        <form
            className="sheet-fields settings-password"
            onSubmit={(event) => {
                event.preventDefault();
                void savePassword();
            }}
        >
            <label className="field">
                <span>Current password</span>
                <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                />
            </label>
            <label className="field">
                <span>New password</span>
                <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(event) => setNext(event.target.value)}
                />
                {short && <span className="gate-hint">At least {MIN_PASSWORD} characters.</span>}
            </label>
            {error && <span className="gate-error">{error}</span>}
            <div className="settings-delete-actions">
                <button className="btn btn-secondary" type="button" onClick={close}>
                    Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={blocked}>
                    {pending ? "One moment…" : "Save password"}
                </button>
            </div>
        </form>
    );
}

function RecurringItem({ item }: { item: Recurring }) {
    const update = useUpdateRecurring();
    const remove = useRemoveRecurring();
    const [amount, setAmount] = useState<string | null>(null);
    const typed = amount === null ? undefined : parsePositive(amount);

    function saveAmount() {
        if (!typed) return;
        const signed = item.kind === "income" ? euros(typed) : euros(-typed);
        update.mutate({ id: item.id, patch: { amount: signed } }, { onSuccess: () => setAmount(null) });
    }

    return (
        <div className={`settings-recurring-item ${item.paused ? "paused" : ""}`}>
            <div className="settings-row">
                <div className="settings-row-text">
                    <span>{item.name}</span>
                    <span className="gate-hint">
                        {cadenceLabel(item)} ·{" "}
                        {item.paused ? "paused" : `next ${dayFormat.format(new Date(`${item.nextDue}T00:00:00Z`))}`}
                    </span>
                </div>
                <span className="settings-recurring-amount">
                    {item.amount > 0 ? "+" : "−"}
                    {withSymbol(formatAmount(item.amount), item.currency)}
                </span>
            </div>
            {amount === null ? (
                <div className="settings-recurring-actions">
                    <button className="btn btn-ghost" onClick={() => setAmount((Math.abs(item.amount) / 100).toFixed(2))}>
                        Edit amount
                    </button>
                    <button
                        className="btn btn-ghost"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: item.id, patch: { paused: !item.paused } })}
                    >
                        {item.paused ? "Resume" : "Pause"}
                    </button>
                    <button
                        className="btn btn-ghost settings-recurring-delete"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                    >
                        Delete
                    </button>
                </div>
            ) : (
                <form
                    className="settings-recurring-actions"
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveAmount();
                    }}
                >
                    <input
                        className="input"
                        inputMode="decimal"
                        autoFocus
                        aria-label={`Amount for ${item.name}`}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                    />
                    <button className="btn btn-secondary" type="button" onClick={() => setAmount(null)}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={!typed || update.isPending}>
                        Save
                    </button>
                </form>
            )}
            {(update.error ?? remove.error) && (
                <span className="gate-error">{(update.error ?? remove.error)?.message}</span>
            )}
        </div>
    );
}

function RecurringList() {
    const recurring = useRecurring();
    const items = recurring.data ?? [];

    return (
        <div className="settings-password settings-recurring">
            <div className="settings-row-text">
                <span>Recurring</span>
                <span className="gate-hint">
                    {items.length === 0
                        ? "Pick “Repeats” when logging an entry and it logs itself from then on."
                        : "These log themselves on their due date."}
                </span>
            </div>
            {items.map((item) => (
                <RecurringItem key={item.id} item={item} />
            ))}
        </div>
    );
}

function DeleteAccount() {
    const queryClient = useQueryClient();
    const [confirming, setConfirming] = useState(false);
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function remove() {
        if (pending || !password) return;
        setPending(true);
        setError(null);
        try {
            await deleteUser(password);
            queryClient.clear();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Something went wrong.");
            setPending(false);
        }
    }

    if (!confirming) {
        return (
            <div className="sheet-fields settings-danger">
                <button className="btn btn-secondary settings-delete" onClick={() => setConfirming(true)}>
                    Delete account
                </button>
            </div>
        );
    }

    return (
        <form
            className="sheet-fields settings-danger"
            onSubmit={(event) => {
                event.preventDefault();
                void remove();
            }}
        >
            <p className="sheet-warning">
                This deletes your account and everything in it. It can't be undone.
            </p>
            <label className="field">
                <span>Password</span>
                <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
            </label>
            {error && <span className="gate-error">{error}</span>}
            <div className="settings-delete-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)}>
                    Cancel
                </button>
                <button className="btn settings-delete-confirm" type="submit" disabled={pending || !password}>
                    {pending ? "Deleting…" : "Delete forever"}
                </button>
            </div>
        </form>
    );
}

type Props = {
    onClose: () => void;
    onSaved: (message: string) => void;
};

export function SettingsSheet({ onClose, onSaved }: Props) {
    const theme = useThemePreference();
    const currency = useDisplayCurrency();
    const updateSettings = useUpdateSettings();
    return (
        <Sheet label="Settings" onClose={onClose}>
            <div className="sheet-head">
                <h4 className="sheet-title">Settings</h4>
            </div>

            <div className="sheet-fields">
                <div className="field">
                    <span>Theme</span>
                    <div className="seg settings-seg">
                        {THEMES.map((option) => (
                            <label key={option.value} className="seg-opt">
                                <input
                                    type="radio"
                                    name="theme"
                                    checked={theme === option.value}
                                    onChange={() => setThemePreference(option.value)}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </div>

                <label className="field">
                    <span>Currency</span>
                    <CurrencySelect
                        value={currency}
                        disabled={updateSettings.isPending}
                        onChange={(chosen) =>
                            updateSettings.mutate(
                                { currency: chosen },
                                { onSuccess: () => onSaved(`Showing amounts in ${chosen}`) },
                            )
                        }
                    />
                    <span className="gate-hint">
                        Totals convert to this currency. Each account keeps its own.
                    </span>
                    {updateSettings.error && <span className="gate-error">{updateSettings.error.message}</span>}
                </label>

                <RecurringList />

                <ChangePassword onSaved={onSaved} />

                <DeleteAccount />
            </div>
        </Sheet>
    );
}
