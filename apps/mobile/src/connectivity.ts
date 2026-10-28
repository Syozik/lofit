import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { API_URL } from "./config";

const PING_TIMEOUT_MS = 5000;
const RECHECK_MS = 15000;

let networkUp = true;
let serverUp = true;
let local = false;
let report: (online: boolean) => void = () => {};
let recheck: ReturnType<typeof setTimeout> | undefined;

async function ping(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
        const response = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
        return response.ok && !response.headers.has("ngrok-error-code");
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function publish(): void {
    report(local || (networkUp && serverUp));
    clearTimeout(recheck);
    if (!local && networkUp && !serverUp) recheck = setTimeout(() => void checkServer(), RECHECK_MS);
}

export async function checkServer(): Promise<void> {
    if (local) return publish();
    serverUp = await ping();
    publish();
}

export function markServerDown(): void {
    if (local || !serverUp) return;
    serverUp = false;
    publish();
}

function applyNetwork(state: Network.NetworkState): void {
    networkUp = state.isConnected !== false && state.isInternetReachable !== false;
    if (networkUp) void checkServer();
    else publish();
}

export function stayOnline(value: boolean): void {
    if (local === value) return;
    local = value;
    serverUp = true;
    void checkServer();
}

export function startConnectivity(): void {
    onlineManager.setEventListener((setOnline) => {
        report = setOnline;
        const refresh = () => void Network.getNetworkStateAsync().then(applyNetwork);
        refresh();
        const subscription = Network.addNetworkStateListener(applyNetwork);
        const foreground = AppState.addEventListener("change", (state) => {
            if (state === "active") refresh();
        });
        return () => {
            subscription.remove();
            foreground.remove();
        };
    });
}

export function useOnline(): boolean {
    return useSyncExternalStore(
        (listener) => onlineManager.subscribe(listener),
        () => onlineManager.isOnline(),
    );
}
