import { primaryTagId, upcomingIn } from "@lofit/domain";
import type { Recurring, Upcoming } from "@lofit/domain";
import { UNTAGGED_KEY } from "./spending";

export type UpcomingSpend = { items: Upcoming[]; total: number; byTag: Map<string, number> };

export function upcomingSpend(recurring: readonly Recurring[], period: string, today: string): UpcomingSpend {
    const items = upcomingIn(recurring, period, today);
    const byTag = new Map<string, number>();
    let total = 0;
    for (const { recurring: item } of items) {
        if (item.kind !== "expense") continue;
        const amount = Math.abs(item.shown);
        total += amount;
        const key = primaryTagId(item) ?? UNTAGGED_KEY;
        byTag.set(key, (byTag.get(key) ?? 0) + amount);
    }
    return { items, total, byTag };
}
