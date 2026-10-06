import type { AppType } from "@lofit/server";
import { hc } from "hono/client";

let client: ReturnType<typeof hc<AppType>> | undefined;

export type ApiOptions = {
    headers?: () => Promise<Record<string, string>>;
};

export function configureApi(baseUrl: string, options: ApiOptions = {}): void {
    const { headers } = options;
    client = hc<AppType>(baseUrl, headers ? { headers, init: { credentials: "omit" } } : {});
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

export async function apiError(response: { status: number; text(): Promise<string> }): Promise<Error> {
    const body = await response.text();
    let message = body;
    try {
        message = (JSON.parse(body) as { error?: string }).error ?? body;
    } catch {
    }
    return new Error(`API ${response.status}: ${message}`);
}
