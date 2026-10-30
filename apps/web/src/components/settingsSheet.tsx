import { changePassword, deleteUser, useDisplayCurrency, useUpdateSettings } from "@lofit/api";
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
                        Amounts keep previous numbers, holdings are re-priced in the new currency.
                    </span>
                    {updateSettings.error && <span className="gate-error">{updateSettings.error.message}</span>}
                </label>

                <ChangePassword onSaved={onSaved} />

                <DeleteAccount />
            </div>
        </Sheet>
    );
}
