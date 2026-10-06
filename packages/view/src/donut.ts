import type { Cents } from "@lofit/domain";
import type { ColorToken } from "./palette";

const SEGMENT_GAP_DEG = 1.6;

export type Slice = {
    key: string;
    label: string;
    value: Cents;
    color: ColorToken;
};

export type Segment = Slice & {
    share: number;
    from: number;
    to: number;
    end: number;
};

function wholeShares(weights: readonly number[]): number[] {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return weights.map(() => 0);

    const exact = weights.map((weight) => (weight / total) * 100);
    const shares = exact.map((value) => Math.floor(value));
    const byRemainder = exact
        .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
        .sort((a, b) => b.remainder - a.remainder);

    let left = 100 - shares.reduce((sum, share) => sum + share, 0);
    for (const { index } of byRemainder) {
        if (left <= 0) break;
        shares[index]! += 1;
        left -= 1;
    }

    return shares;
}

export function toSegments(slices: readonly Slice[]): Segment[] {
    const weights = slices.map((slice) => Math.abs(slice.value));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return [];

    const shares = wholeShares(weights);
    const segments: Segment[] = [];
    let sweptDeg = 0;

    for (const [index, slice] of slices.entries()) {
        const sweep = (weights[index]! / total) * 360;
        const from = sweptDeg;
        sweptDeg += sweep;
        const gap = slices.length > 1 ? Math.min(SEGMENT_GAP_DEG, sweep / 3) : 0;

        segments.push({
            ...slice,
            share: shares[index]!,
            from,
            to: sweptDeg - gap,
            end: sweptDeg,
        });
    }

    return segments;
}
