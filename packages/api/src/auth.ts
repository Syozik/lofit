import { createAuthClient } from "better-auth/react";

type AuthClient = ReturnType<typeof createAuthClient>;

let client: AuthClient | undefined;

export function configureAuth(baseUrl: string): void {
    client = createAuthClient({ baseURL: `${baseUrl}/api/auth` });
}

function auth(): AuthClient {
    if (!client) throw new Error("Call configureAuth(baseUrl) before using the session.");
    return client;
}

export function useSession() {
    return auth().useSession();
}

export async function signIn(email: string, password: string): Promise<void> {
    const { error } = await auth().signIn.email({ email, password });
    if (error) throw new Error(error.message ?? "Those details did not work.");
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
    const { error } = await auth().signUp.email({ name, email, password });
    if (error) throw new Error(error.message ?? "That account could not be created.");
}

export async function signOut(): Promise<void> {
    await auth().signOut();
}
