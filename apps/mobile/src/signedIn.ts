import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { markSignedIn } from "./connectivity";
import { forgetCache } from "./queryClient";

const KEY = "lofit-signed-in";
const OWNER_KEY = "lofit-cache-owner";

export function useRememberedSignIn(signedIn: boolean | null): boolean | null {
    const [remembered, setRemembered] = useState<boolean | null>(null);

    useEffect(() => {
        void AsyncStorage.getItem(KEY)
            .catch(() => null)
            .then((value) => setRemembered(value === "1"));
    }, []);

    useEffect(() => {
        if (signedIn === true) void AsyncStorage.setItem(KEY, "1");
        if (signedIn === false) void AsyncStorage.removeItem(KEY);
    }, [signedIn]);

    return remembered;
}

export async function forgetSignIn(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
}

export async function claimCache(client: QueryClient, userId: string): Promise<void> {
    const owner = await AsyncStorage.getItem(OWNER_KEY).catch(() => null);
    if (owner !== userId) {
        await forgetCache(client, "account");
        await AsyncStorage.setItem(OWNER_KEY, userId);
    }
    markSignedIn();
}
