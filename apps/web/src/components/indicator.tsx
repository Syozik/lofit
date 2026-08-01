import styles from "./indicator.module.css";
import { useEffect, useState } from "react";

export function Indicator() {
    const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);

        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    return <span className={`${styles.indicator} ${isOnline ? styles.online : styles.offline}`} />;
}
