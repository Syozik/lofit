import { rangeWindow } from "@lofit/domain";
import type { DayWindow } from "@lofit/domain";

export function defaultCustom(first: string, last: string): DayWindow {
    const from = rangeWindow("1m", last).from ?? first;
    return { from: from < first ? first : from, to: last };
}
