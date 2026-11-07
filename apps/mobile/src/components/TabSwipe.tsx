import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const TABS = ["/", "/accounts", "/spending"] as const;

const START = 40;
const DISTANCE = 80;
const SPEED = 600;

export function TabSwipe({ children }: { children: ReactNode }) {
    const router = useRouter();
    const path = usePathname();
    const at = TABS.indexOf(path as (typeof TABS)[number]);

    function go(step: number) {
        const next = TABS[at + step];
        if (at >= 0 && next) router.navigate(next);
    }

    const swipe = Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-START, START])
        .failOffsetY([-15, 15])
        .onEnd((event) => {
            const flung = Math.abs(event.translationX) > DISTANCE || Math.abs(event.velocityX) > SPEED;
            if (flung) go(event.translationX < 0 ? 1 : -1);
        });

    return <GestureDetector gesture={swipe}>{children}</GestureDetector>;
}
