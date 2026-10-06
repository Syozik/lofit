import { expoClient } from "@better-auth/expo/client";
import { configureApi, configureAuth } from "@lofit/api";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

type CookieSource = { getCookie: () => Promise<string> };

const auth = configureAuth(API_URL, [
    expoClient({ scheme: "lofit", storagePrefix: "lofit", storage: SecureStore }),
]) as unknown as CookieSource;

configureApi(API_URL, {
    headers: async () => {
        const cookie = await auth.getCookie();
        return cookie ? { cookie } : {};
    },
});
