import { DEFAULT_GROUP_NAMES, DEFAULT_TAGS, INVESTMENTS_GROUP } from "@lofit/domain";
import type { Account, Budget, Group, Snapshot, Tag, Transaction } from "@lofit/domain";
import { newId } from "./ids";
import { recordSnapshot } from "./snapshots";

export type KeyValueStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
};

export type StoredAccount = Account & { createdAt: string };
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

export type Store = {
    data: Ledger;
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

    async function load(): Promise<void> {
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
        await enqueue(() => Promise.all(COLLECTIONS.map((key) => storage.removeItem(PREFIX + key))));
    }

    return { data, start, save, erase };
}
