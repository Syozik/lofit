import { DEFAULT_GROUP_NAMES, DEFAULT_TAGS, EURO, INVESTMENTS_GROUP, isCurrency } from "@lofit/domain";
import type { Account, Budget, Group, Settings, Snapshot, Tag, Transaction } from "@lofit/domain";
import { newId } from "./ids";
import { recordSnapshot } from "./snapshots";

export type KeyValueStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
};

export type StoredAccount = Omit<Account, "currency" | "nativeBalance"> & { createdAt: string };
export type StoredTransaction = Transaction & { createdAt: string };

export type Ledger = {
    groups: Group[];
    accounts: StoredAccount[];
    transactions: StoredTransaction[];
    tags: Tag[];
    budgets: Budget[];
    snapshots: Snapshot[];
};

export type Collection = keyof Ledger;

const COLLECTIONS: readonly Collection[] = [
    "groups",
    "accounts",
    "transactions",
    "tags",
    "budgets",
    "snapshots",
];

const PREFIX = "lofit-local:";

const SETTINGS = `${PREFIX}settings`;

export type Store = {
    data: Ledger;
    settings: Settings;
    saveSettings(): Promise<void>;
    start(): Promise<void>;
    save(...touched: Collection[]): Promise<void>;
    erase(): Promise<void>;
};

function emptyLedger(): Ledger {
    return { groups: [], accounts: [], transactions: [], tags: [], budgets: [], snapshots: [] };
}

function seed(data: Ledger): void {
    data.groups = DEFAULT_GROUP_NAMES.map((name, position) => ({
        id: newId(),
        name,
        position,
        invests: name === INVESTMENTS_GROUP,
    }));
    data.tags = DEFAULT_TAGS.map(({ name, kind }, position) => ({ id: newId(), name, kind, position }));
}

export function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function createStore(storage: KeyValueStorage): Store {
    const data = emptyLedger();
    const settings: Settings = { currency: EURO };
    let started: Promise<void> | undefined;
    let writing: Promise<void> = Promise.resolve();

    function enqueue(work: () => Promise<unknown>): Promise<void> {
        const next = writing.then(async () => {
            await work();
        });
        writing = next.catch(() => undefined);
        return next;
    }

    function save(...touched: Collection[]): Promise<void> {
        recordSnapshot(data, today());
        const keys = new Set<Collection>([...touched, "snapshots"]);
        return enqueue(() =>
            Promise.all([...keys].map((key) => storage.setItem(PREFIX + key, JSON.stringify(data[key])))),
        );
    }

    function saveSettings(): Promise<void> {
        return enqueue(() => storage.setItem(SETTINGS, JSON.stringify(settings)));
    }

    async function load(): Promise<void> {
        const saved = JSON.parse((await storage.getItem(SETTINGS)) ?? "{}") as Partial<Settings>;
        settings.currency = isCurrency(saved.currency) ? saved.currency : EURO;

        const stored = await Promise.all(COLLECTIONS.map((key) => storage.getItem(PREFIX + key)));
        if (stored[0] === null) {
            Object.assign(data, emptyLedger());
            seed(data);
            await save(...COLLECTIONS);
            return;
        }
        COLLECTIONS.forEach((key, index) => {
            const text = stored[index];
            data[key] = text ? JSON.parse(text) : [];
        });
        await save();
    }

    function start(): Promise<void> {
        started ??= load().catch((error: unknown) => {
            started = undefined;
            throw error;
        });
        return started;
    }

    async function erase(): Promise<void> {
        await started?.catch(() => undefined);
        started = undefined;
        Object.assign(data, emptyLedger());
        settings.currency = EURO;
        await enqueue(() =>
            Promise.all([...COLLECTIONS.map((key) => PREFIX + key), SETTINGS].map((key) => storage.removeItem(key))),
        );
    }

    return { data, settings, saveSettings, start, save, erase };
}
