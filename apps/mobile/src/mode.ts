import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalBackend } from "@lofit/local";
import { useSyncExternalStore } from "react";
import { stayOnline } from "./connectivity";
import { connectAccount, connectLocal } from "./session";

export type Mode = "account" | "guest";

const KEY = "lofit-mode";

export const localBackend = createLocalBackend(AsyncStorage);

let mode: Mode | null = null;
const listeners = new Set<() => void>();

function apply(next: Mode): void {
    if (next === "guest") connectLocal(localBackend.fetch);
    else connectAccount();
    stayOnline(next === "guest");
    mode = next;
    listeners.forEach((listener) => listener());
}

void AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((value) => apply(value === "guest" ? "guest" : "account"));

export async function setMode(next: Mode): Promise<void> {
    if (next === "guest") await AsyncStorage.setItem(KEY, next);
    else await AsyncStorage.removeItem(KEY);
    apply(next);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useMode(): Mode | null {
    return useSyncExternalStore(subscribe, () => mode);
}

export function useGuest(): boolean {
    return useMode() === "guest";
}
