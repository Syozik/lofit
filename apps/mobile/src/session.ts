import { expoClient } from "@better-auth/expo/client";
import { configureApi, configureAuth, configureIds } from "@lofit/api";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";
import { markServerDown } from "./connectivity";

type CookieSource = { getCookie: () => Promise<string> };

const auth = configureAuth(API_URL, [
    expoClient({ scheme: "lofit", storagePrefix: "lofit", storage: SecureStore }),
]) as unknown as CookieSource;

configureIds(() => Crypto.randomUUID());

configureApi(API_URL, {
    headers: async () => {
        const cookie = await auth.getCookie();
        return cookie ? { cookie } : {};
    },
    onUnreachable: markServerDown,
});
