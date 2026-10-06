import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "lofit-signed-in";

export function useRememberedSignIn(signedIn: boolean | null): boolean {
    const [remembered, setRemembered] = useState(false);

    useEffect(() => {
        void AsyncStorage.getItem(KEY).then((value) => setRemembered(value === "1"));
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
