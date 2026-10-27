import { ApiError, useAccounts, useAddTransaction, useImportScreenshot, useTags } from "@lofit/api";
import type { Screenshot } from "@lofit/api";
import { euros } from "@lofit/domain";
import type { ImportDraft, ScreenshotImport as Found } from "@lofit/domain";
import { parsePositive } from "@lofit/view";
import { useEffect, useState } from "react";

type MediaType = Screenshot["mediaType"];

const MEDIA_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const MAX_BASE64 = 4_500_000;

function readBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
        reader.onerror = () => reject(new Error("Couldn't read that image"));
        reader.readAsDataURL(blob);
    });
}

async function asJpeg(file: File, scale: number): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85).split(",", 2)[1] ?? "";
}

async function encode(file: File): Promise<Screenshot> {
    const image = await readBase64(file);
    if (MEDIA_TYPES.includes(file.type) && image.length <= MAX_BASE64) {
        return { image, mediaType: file.type as MediaType };
    }

    let scale = Math.min(1, Math.sqrt(MAX_BASE64 / image.length));
    let jpeg = await asJpeg(file, scale);
    while (jpeg.length > MAX_BASE64 && scale > 0.1) {
        scale *= 0.75;
        jpeg = await asJpeg(file, scale);
    }
    return { image: jpeg, mediaType: "image/jpeg" };
}

function messageOf(error: unknown): string {
    if (error instanceof ApiError) return error.message.replace(/^API \d+: /, "");
    if (error instanceof TypeError) return "Couldn't reach lofit. Screenshot import needs a connection.";
    return error instanceof Error ? error.message : "Something went wrong";
}

function toInstant(day: string): string {
    return `${day}T${new Date().toISOString().slice(11)}`;
}

type Row = {
    key: number;
    checked: boolean;
    name: string;
    kind: ImportDraft["kind"];
    amount: string;
    day: string;
    accountId: string;
    tagId: string;
    currency?: string;
};

function rowsOf(drafts: readonly ImportDraft[]): Row[] {
    return drafts.map((draft, key) => ({
        key,
        checked: !draft.currency,
        name: draft.name,
        kind: draft.kind,
        amount: (Math.abs(draft.amount) / 100).toFixed(2),
        day: draft.day,
        accountId: draft.accountId ?? "",
        tagId: draft.tagIds[0] ?? "",
        ...(draft.currency ? { currency: draft.currency } : {}),
    }));
}

function entries(count: number): string {
    return count === 1 ? "1 entry" : `${count} entries`;
}

type Stage = { step: "reading" } | { step: "failed"; message: string } | { step: "review"; found: Found };

type Props = {
    file: File;
    defaultAccount: string;
    onBack: () => void;
    onClose: () => void;
    onSaved: (message: string) => void;
};

export function ScreenshotImport({ file, defaultAccount, onBack, onClose, onSaved }: Props) {
    const { data: accounts = [] } = useAccounts();
    const { data: tags = [] } = useTags();
    const read = useImportScreenshot();
    const addEntry = useAddTransaction();

    const [stage, setStage] = useState<Stage>({ step: "reading" });
    const [rows, setRows] = useState<Row[]>([]);

    const fallbackAccount = defaultAccount || accounts[0]?.id || "";

    const { mutateAsync } = read;

    useEffect(() => {
        if (stage.step !== "reading") return;
        let live = true;
        encode(file)
            .then(mutateAsync)
            .then(
                (found) => {
                    if (!live) return;
                    setRows(rowsOf(found.drafts));
                    setStage({ step: "review", found });
                },
                (error: unknown) => {
                    if (!live) return;
                    setStage({ step: "failed", message: messageOf(error) });
                },
            );
        return () => {
            live = false;
        };
    }, [file, stage.step, mutateAsync]);

    function change(key: number, patch: Partial<Row>) {
        setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    }

    const chosen = rows.filter((row) => row.checked);
    const invalid = chosen.some(
        (row) => !row.name.trim() || !parsePositive(row.amount) || !row.day || !(row.accountId || fallbackAccount),
    );

    function save() {
        if (!chosen.length || invalid) return;
        for (const row of chosen) {
            const value = parsePositive(row.amount);
            if (!value) continue;
            addEntry.mutate({
                name: row.name.trim(),
                kind: row.kind,
                tagIds: row.tagId ? [row.tagId] : [],
                accountId: row.accountId || fallbackAccount,
                amount: row.kind === "income" ? euros(value) : euros(-value),
                occurredAt: toInstant(row.day),
            });
        }
        onSaved(`Added ${entries(chosen.length)}`);
        onClose();
    }

    if (stage.step === "reading") {
        return (
            <>
                <div className="sheet-head">
                    <h4 className="sheet-title">From screenshot</h4>
                </div>
                <div className="import-status" role="status">
                    <span className="import-spinner" aria-hidden />
                    <span className="import-status-title">Reading screenshot…</span>
                    <span className="import-status-note">This takes a few seconds</span>
                </div>
                <div className="sheet-actions">
                    <button className="btn btn-secondary" onClick={onBack}>
                        Cancel
                    </button>
                </div>
            </>
        );
    }

    if (stage.step === "failed") {
        return (
            <>
                <div className="sheet-head">
                    <h4 className="sheet-title">From screenshot</h4>
                </div>
                <div className="import-status" role="alert">
                    <span className="import-status-title">Couldn't read the screenshot</span>
                    <span className="import-status-note">{stage.message}</span>
                </div>
                <div className="sheet-actions">
                    <button className="btn btn-secondary" onClick={onBack}>
                        Back
                    </button>
                    <button className="btn btn-primary sheet-save" onClick={() => setStage({ step: "reading" })}>
                        Try again
                    </button>
                </div>
            </>
        );
    }

    const { skipped } = stage.found;
    const skippedNote = skipped > 0 ? `Skipped ${skipped} already logged` : undefined;

    if (rows.length === 0) {
        return (
            <>
                <div className="sheet-head">
                    <h4 className="sheet-title">Nothing new found</h4>
                </div>
                <div className="import-status">
                    <span className="import-status-note">
                        {skippedNote ?? "No entries could be read from this screenshot."}
                    </span>
                </div>
                <div className="sheet-actions">
                    <button className="btn btn-secondary" onClick={onBack}>
                        Back
                    </button>
                    <button className="btn btn-primary sheet-save" onClick={onClose}>
                        Close
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="sheet-head">
                <h4 className="sheet-title">
                    Found {entries(rows.length)}
                </h4>
                {skippedNote && <span className="sheet-note">{skippedNote}</span>}
            </div>

            <div className="import-rows">
                {rows.map((row) => {
                    const badAmount = row.checked && !parsePositive(row.amount);
                    return (
                        <div key={row.key} className={`import-row ${row.checked ? "" : "off"}`}>
                            <div className="import-row-main">
                                <input
                                    type="checkbox"
                                    className="import-check"
                                    aria-label={`Add ${row.name || "entry"}`}
                                    checked={row.checked}
                                    onChange={(event) => change(row.key, { checked: event.target.checked })}
                                />
                                <input
                                    autoComplete="off"
                                    className="input import-name"
                                    aria-label="Description"
                                    aria-invalid={row.checked && !row.name.trim()}
                                    value={row.name}
                                    onChange={(event) => change(row.key, { name: event.target.value })}
                                />
                                <span className={`budget-input input import-amount ${badAmount ? "invalid" : ""}`}>
                                    <button
                                        className={`import-sign ${row.kind}`}
                                        aria-label={`${row.kind === "income" ? "Income" : "Expense"}, tap to change`}
                                        onClick={() =>
                                            change(row.key, {
                                                kind: row.kind === "income" ? "expense" : "income",
                                            })
                                        }
                                    >
                                        {row.kind === "income" ? "+" : "−"}
                                    </button>
                                    <span className="budget-input-currency">€</span>
                                    <input
                                        autoComplete="off"
                                        inputMode="decimal"
                                        aria-label="Amount"
                                        aria-invalid={badAmount}
                                        value={row.amount}
                                        onChange={(event) => change(row.key, { amount: event.target.value })}
                                    />
                                </span>
                            </div>
                            {row.currency && (
                                <span className="import-warning">{row.currency} — check amount</span>
                            )}
                            <div className="import-row-meta">
                                <input
                                    autoComplete="off"
                                    className="input"
                                    type="date"
                                    aria-label="Date"
                                    value={row.day}
                                    onChange={(event) => change(row.key, { day: event.target.value })}
                                />
                                <select
                                    className="input"
                                    aria-label="Account"
                                    value={row.accountId || fallbackAccount}
                                    onChange={(event) => change(row.key, { accountId: event.target.value })}
                                >
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    aria-label="Tag"
                                    value={row.tagId}
                                    onChange={(event) => change(row.key, { tagId: event.target.value })}
                                >
                                    <option value="">No tag</option>
                                    {tags.map((tag) => (
                                        <option key={tag.id} value={tag.id}>
                                            {tag.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="sheet-actions">
                <button className="btn btn-secondary" onClick={onBack}>
                    Cancel
                </button>
                <button
                    className="btn btn-primary sheet-save"
                    disabled={!chosen.length || invalid}
                    onClick={save}
                >
                    {chosen.length ? `Add ${entries(chosen.length)}` : "Add entries"}
                </button>
            </div>
        </>
    );
}
