import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureMutations, isUnreachable } from "@lofit/api";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { markServerDown, startConnectivity } from "./connectivity";
import { reportSyncIssue } from "./syncIssues";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const CACHE_VERSION = "1";

function friendly(error: Error): string {
    return error.message.replace(/^API \d+: /, "");
}

export function createQueryClient(): QueryClient {
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
                else reportSyncIssue(`Couldn't sync: ${friendly(error)}`);
            },
        }),
    });

    configureMutations(client);
    return client;
}

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "lofit-cache" });

export const PERSIST_MAX_AGE_MS = WEEK_MS;
