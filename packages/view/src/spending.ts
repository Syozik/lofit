import { cents } from "@lofit/domain";
import type { Tag, TagSpend } from "@lofit/domain";
import type { Slice } from "./donut";
import { CATEGORY_COLORS, OTHER_COLOR, UNTAGGED_COLOR } from "./palette";

export const UNTAGGED_KEY = "untagged";

const OTHER_KEY = "other";

const SHOWN_TAGS = 5;

export type SpendSlices = {
    slices: Slice[];
    tagsOf: Map<string, ReadonlySet<string>>;
};

function keyOf(row: TagSpend): string {
    return row.tagId ?? UNTAGGED_KEY;
}

export function spendSlices(rows: readonly TagSpend[], tags: readonly Tag[]): SpendSlices {
    const ranked = rows.filter((row) => row.spent > 0).sort((a, b) => b.spent - a.spent);
    const fits = ranked.length <= SHOWN_TAGS + 1;
    const shown = fits ? ranked : ranked.slice(0, SHOWN_TAGS);
    const tail = fits ? [] : ranked.slice(SHOWN_TAGS);

    const position = new Map(tags.map((tag) => [tag.id, tag.position]));
    const colors = new Map(
        shown
            .filter((row) => row.tagId !== undefined)
            .sort((a, b) => (position.get(a.tagId!) ?? 0) - (position.get(b.tagId!) ?? 0))
            .map((row, index) => [keyOf(row), CATEGORY_COLORS[index % CATEGORY_COLORS.length]!]),
    );

    const slices: Slice[] = shown.map((row) => ({
        key: keyOf(row),
        label: row.label,
        value: row.spent,
        color: colors.get(keyOf(row)) ?? UNTAGGED_COLOR,
    }));
    const tagsOf = new Map<string, ReadonlySet<string>>(
        shown.map((row) => [keyOf(row), new Set([keyOf(row)])]),
    );

    if (tail.length > 0) {
        slices.push({
            key: OTHER_KEY,
            label: `Other (${tail.length})`,
            value: cents(tail.reduce((sum, row) => sum + row.spent, 0)),
            color: OTHER_COLOR,
        });
        tagsOf.set(OTHER_KEY, new Set(tail.map(keyOf)));
    }

    return { slices, tagsOf };
}
