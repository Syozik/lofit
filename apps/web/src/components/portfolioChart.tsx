import {
    allocation,
    formatEuros,
    gainsBySymbol,
    portfolioGain,
    sumCents,
    holdingValue,
} from "@lofit/domain";
import type { Cents, Delta, Holding, HoldingGain } from "@lofit/domain";
import { useState } from "react";
import { rankColor } from "../helpers/palette";

type Mode = "allocation" | "gains";

const MODES: readonly Mode[] = ["allocation", "gains"];

const MODE_LABELS: Record<Mode, string> = { allocation: "Allocation", gains: "Gains" };

function signedEuros(amount: Cents): string {
    return `${amount < 0 ? "−" : "+"}€${Math.round(Math.abs(amount) / 100).toLocaleString("en-US")}`;
}

function signedPercent(pct: number): string {
    return `${pct < 0 ? "−" : "+"}${Math.abs(pct).toFixed(1)}%`;
}

function GainSummary({ gain }: { gain: Delta }) {
    return (
        <span className={`portfolio-gain ${gain.favourable ? "up" : ""}`}>
            {signedEuros(gain.amount)} · {signedPercent(gain.pct)}
        </span>
    );
}

function Allocation({ holdings }: { holdings: readonly Holding[] }) {
    const shares = allocation(holdings);

    return (
        <>
            <div className="trend-strip">
                {shares.map((share, rank) => (
                    <span
                        key={share.key}
                        title={`${share.label} ${Math.round(share.pct)}%`}
                        style={{ width: `${share.pct.toFixed(1)}%`, background: rankColor(rank, share.key === "other") }}
                    />
                ))}
            </div>

            <div className="trend-parts">
                {shares.map((share, rank) => (
                    <div key={share.key} className="trend-part">
                        <span className="trend-dot" style={{ background: rankColor(rank, share.key === "other") }} />
                        <span className="trend-name">{share.label}</span>
                        <span className="trend-value">{formatEuros(share.value)}</span>
                        <span className="trend-share">{Math.round(share.pct)}%</span>
                    </div>
                ))}
            </div>
        </>
    );
}

function GainBar({ row, reach, diverging }: { row: HoldingGain; reach: number; diverging: boolean }) {
    const length = reach === 0 ? 0 : (Math.abs(row.gain.pct) / reach) * (diverging ? 50 : 100);
    const start = !diverging ? 0 : row.gain.pct < 0 ? 50 - length : 50;

    return (
        <div className="gain-row" title={`${row.label} ${signedEuros(row.gain.amount)}`}>
            <span className="gain-name">{row.label}</span>
            <span className={`gain-track ${diverging ? "diverging" : ""}`}>
                <span
                    className={`gain-fill ${row.gain.favourable ? "up" : ""}`}
                    style={{ left: `${start}%`, width: `${Math.max(length, 0.6)}%` }}
                />
            </span>
            <span className={`gain-pct ${row.gain.favourable ? "up" : ""}`}>{signedPercent(row.gain.pct)}</span>
            <span className="gain-amount">{signedEuros(row.gain.amount)}</span>
        </div>
    );
}

function Gains({ holdings }: { holdings: readonly Holding[] }) {
    const rows = gainsBySymbol(holdings);
    if (rows.length === 0) return <span className="portfolio-empty">Add what you paid to see gains</span>;

    const reach = Math.max(...rows.map((row) => Math.abs(row.gain.pct)));
    const diverging = rows.some((row) => row.gain.pct < 0);

    return (
        <div className="gain-rows">
            {rows.map((row) => (
                <GainBar key={row.key} row={row} reach={reach} diverging={diverging} />
            ))}
        </div>
    );
}

export function PortfolioChart({ holdings }: { holdings: readonly Holding[] }) {
    const [mode, setMode] = useState<Mode>("allocation");
    const gain = portfolioGain(holdings);

    return (
        <div className="section portfolio">
            <div className="chart-head">
                <div className="portfolio-head">
                    <span className="kicker">Portfolio</span>
                    <span className="portfolio-value">{formatEuros(sumCents(holdings.map(holdingValue)))}</span>
                    {gain && <GainSummary gain={gain} />}
                </div>
                <div className="seg chart-modes">
                    {MODES.map((option) => (
                        <label key={option} className="seg-opt">
                            <input
                                type="radio"
                                name="portfolio-mode"
                                checked={mode === option}
                                onChange={() => setMode(option)}
                            />
                            {MODE_LABELS[option]}
                        </label>
                    ))}
                </div>
            </div>

            {mode === "allocation" ? <Allocation holdings={holdings} /> : <Gains holdings={holdings} />}
        </div>
    );
}
