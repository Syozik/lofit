export const TAG_KINDS = ["expense", "income"] as const;

export type TagKind = (typeof TAG_KINDS)[number];

export interface Tag {
    id: string;
    name: string;
    kind: TagKind;
    position: number;
}

export type NewTag = Pick<Tag, "name"> & { id?: string; kind?: TagKind };

export const DEFAULT_TAGS: readonly { name: string; kind: TagKind }[] = [
    { name: "Housing", kind: "expense" },
    { name: "Groceries", kind: "expense" },
    { name: "Eating out", kind: "expense" },
    { name: "Transport", kind: "expense" },
    { name: "Subscriptions", kind: "expense" },
    { name: "Other", kind: "expense" },
    { name: "Salary", kind: "income" },
    { name: "Holiday", kind: "expense" },
];

export const DEFAULT_TAG_NAMES: readonly string[] = DEFAULT_TAGS.map((tag) => tag.name);

export function defaultTags(): NewTag[] {
    return DEFAULT_TAGS.map((tag) => ({ ...tag }));
}

export function sameTagName(one: string, other: string): boolean {
    return one.trim().toLowerCase() === other.trim().toLowerCase();
}

export function tagsFor<T extends Pick<Tag, "kind">>(
    tags: readonly T[],
    kind: "expense" | "income" | "transfer",
): T[] {
    return kind === "transfer" ? [] : tags.filter((tag) => tag.kind === kind);
}
