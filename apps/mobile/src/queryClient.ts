import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureMutations, isUnreachable } from "@lofit/api";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { markServerDown, startConnectivity } from "./connectivity";
import type { Mode } from "./mode";
import { reportSyncIssue } from "./syncIssues";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const CACHE_VERSION = "1";

function friendly(error: Error): string {
    return error.message.replace(/^API \d+: /, "");
}

export function createQueryClient(mode: Mode): QueryClient {
    startConnectivity();

    const client = new QueryClient({
        defaultOptions: {
            queries: {
                gcTime: WEEK_MS,
                staleTime: 30_000,
                retry: (failures, error) => !isUnreachable(error) && failures < 2,
            },
        },
        queryCache: new QueryCache({
            onError: (error) => {
                if (isUnreachable(error)) markServerDown();
            },
        }),
        mutationCache: new MutationCache({
            onError: (error) => {
                if (isUnreachable(error)) markServerDown();
                else reportSyncIssue(`${mode === "guest" ? "Couldn't save" : "Couldn't sync"}: ${friendly(error)}`);
            },
        }),
    });

    configureMutations(client);
    return client;
}

const persisters = {
    account: createAsyncStoragePersister({ storage: AsyncStorage, key: "lofit-cache" }),
    guest: createAsyncStoragePersister({ storage: AsyncStorage, key: "lofit-guest-cache" }),
};

export function persisterFor(mode: Mode) {
    return persisters[mode];
}

export async function forgetCache(client: QueryClient, mode: Mode): Promise<void> {
    client.clear();
    await persisters[mode].removeClient();
}

export const PERSIST_MAX_AGE_MS = WEEK_MS;
