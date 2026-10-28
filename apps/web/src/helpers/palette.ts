import type { ColorToken } from "@lofit/view";

export function cssColor(token: ColorToken): string {
    return `var(--chart-${token}, var(--color-${token}))`;
}
