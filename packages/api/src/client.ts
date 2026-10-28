import type { AppType } from "@lofit/server";
import { hc } from "hono/client";

let client: ReturnType<typeof hc<AppType>> | undefined;

export type ApiOptions = {
    headers?: () => Promise<Record<string, string>>;
    onUnreachable?: () => void;
    fetch?: typeof fetch;
};

const GATEWAY_STATUSES = new Set([502, 503, 504]);

function gatewayFailure(response: { status: number; headers: Headers }): boolean {
    return GATEWAY_STATUSES.has(response.status) || response.headers.has("ngrok-error-code");
}

export function configureApi(baseUrl: string, options: ApiOptions = {}): void {
    const { headers, onUnreachable, fetch: local } = options;
    const watched: typeof fetch = async (input, init) => {
        try {
            const response = await fetch(input, init);
            if (gatewayFailure(response)) onUnreachable?.();
            return response;
        } catch (error) {
            onUnreachable?.();
            throw error;
        }
    };

    client = hc<AppType>(baseUrl, {
        ...(headers ? { headers, init: { credentials: "omit" } } : {}),
        ...(local ? { fetch: local } : onUnreachable ? { fetch: watched } : {}),
    });
}

export function api() {
    if (!client) throw new Error("Call configureApi(baseUrl) before making requests.");
    return client.api;
}

export type FromJson<T> = T extends string | number | boolean | null
    ? T
    : T extends readonly (infer Item)[]
      ? FromJson<Item>[]
      : { [K in keyof T]: FromJson<Exclude<T[K], undefined>> };

export function fromJson<T>(value: T): FromJson<T> {
    return value as FromJson<T>;
}

export class ApiError extends Error {
    readonly status: number;
    readonly unreachable: boolean;

    constructor(status: number, message: string, unreachable: boolean) {
        super(`API ${status}: ${message}`);
        this.name = "ApiError";
        this.status = status;
        this.unreachable = unreachable;
    }
}

export async function apiError(response: { status: number; headers: Headers; text(): Promise<string> }): Promise<ApiError> {
    const body = await response.text();
    let message = body;
    try {
        message = (JSON.parse(body) as { error?: string }).error ?? body;
    } catch {
    }
    return new ApiError(response.status, message, gatewayFailure(response));
}

export function isUnreachable(error: unknown): boolean {
    if (error instanceof ApiError) return error.unreachable;
    return error instanceof TypeError;
}
