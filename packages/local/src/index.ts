import { localApp } from "./app";
import { createStore } from "./store";
import type { KeyValueStorage } from "./store";

export type { KeyValueStorage } from "./store";

export type LocalBackend = {
    fetch: typeof fetch;
    start(): Promise<void>;
    erase(): Promise<void>;
};

export function createLocalBackend(storage: KeyValueStorage): LocalBackend {
    const store = createStore(storage);
    const app = localApp(store);

    return {
        fetch: async (input, init) => {
            await store.start();
            return app.fetch(new Request(input, init));
        },
        start: store.start,
        erase: store.erase,
    };
}
