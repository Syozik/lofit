export interface Tag {
    id: string;
    name: string;
    position: number;
}

export type NewTag = Pick<Tag, "name"> & { id?: string };

export const DEFAULT_TAG_NAMES: readonly string[] = [
    "Housing",
    "Groceries",
    "Eating out",
    "Transport",
    "Subscriptions",
    "Other",
    "Salary",
    "Holiday",
];

export function defaultTags(): NewTag[] {
    return DEFAULT_TAG_NAMES.map((name) => ({ name }));
}

export function sameTagName(one: string, other: string): boolean {
    return one.trim().toLowerCase() === other.trim().toLowerCase();
}
