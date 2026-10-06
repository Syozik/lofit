import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useSyncExternalStore } from "react";
import { API_URL } from "./config";

const PING_TIMEOUT_MS = 5000;
const RECHECK_MS = 15000;

let networkUp = true;
let serverUp = true;
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
    report(networkUp && serverUp);
    clearTimeout(recheck);
    if (networkUp && !serverUp) recheck = setTimeout(() => void checkServer(), RECHECK_MS);
}

export async function checkServer(): Promise<void> {
    serverUp = await ping();
    publish();
}

export function markServerDown(): void {
    if (!serverUp) return;
    serverUp = false;
    publish();
}

function applyNetwork(state: Network.NetworkState): void {
    networkUp = state.isConnected !== false && state.isInternetReachable !== false;
    if (networkUp) void checkServer();
    else publish();
}

export function startConnectivity(): void {
    onlineManager.setEventListener((setOnline) => {
        report = setOnline;
        void Network.getNetworkStateAsync().then(applyNetwork);
        const subscription = Network.addNetworkStateListener(applyNetwork);
        return () => subscription.remove();
    });
}

export function useOnline(): boolean {
    return useSyncExternalStore(
        (listener) => onlineManager.subscribe(listener),
        () => onlineManager.isOnline(),
    );
}
