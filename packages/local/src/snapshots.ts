import { netWorthGroups, netWorthItems } from "@lofit/domain";
import type { Ledger } from "./store";

export function recordSnapshot(data: Ledger, day: string): void {
    const totals = netWorthGroups(netWorthItems(data.accounts, []), data.groups);
    const others = data.snapshots.filter((snapshot) => snapshot.day !== day);

    data.snapshots =
        totals.length === 0
            ? others
            : [
                  ...others,
                  {
                      day,
                      groups: totals.map((entry) => ({ groupId: entry.group.id, amount: entry.total })),
                  },
              ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
