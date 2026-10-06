export interface Group {
    id: string;
    name: string;
    position: number;
    invests: boolean;
}

export type NewGroup = Pick<Group, "name"> & { id?: string };

export const ALL_GROUPS = "all";

export type Scope = typeof ALL_GROUPS | string;

export const INVESTMENTS_GROUP = "Investments";

export const DEFAULT_GROUP_NAMES: readonly string[] = ["Cash", INVESTMENTS_GROUP];

export function sameGroupName(one: string, other: string): boolean {
    return one.trim().toLowerCase() === other.trim().toLowerCase();
}

export function byPosition(groups: readonly Group[]): Group[] {
    return [...groups].sort((one, other) => one.position - other.position);
}

export function investingGroups(groups: readonly Group[]): Group[] {
    return byPosition(groups).filter((group) => group.invests);
}
