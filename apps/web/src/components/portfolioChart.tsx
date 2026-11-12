import { useTrades } from "@lofit/api";
import { allocation, formatMoney, gainsBySymbol, portfolioGain, withSymbol } from "@lofit/domain";
import type { Cents, Delta, Holding, HoldingGain } from "@lofit/domain";
import { useState } from "react";
import { dayFormat, rankColor, tradeGainLabel, tradeNote, tradeUnits } from "@lofit/view";
import { cssColor } from "../helpers/palette";
import { useDesktop } from "../useDesktop";

type Mode = "allocation" | "gains" | "buys";

const MODES: readonly Mode[] = ["allocation", "gains", "buys"];

const MODE_LABELS: Record<Mode, string> = { allocation: "Allocation", gains: "Gains", buys: "Buys" };

function signedEuros(amount: Cents): string {
    return `${amount < 0 ? "−" : "+"}${withSymbol(Math.round(Math.abs(amount) / 100).toLocaleString("en-US"))}`;
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
                        style={{ width: `${share.pct.toFixed(1)}%`, background: cssColor(rankColor(rank, share.key === "other")) }}
                    />
                ))}
            </div>

            <div className="trend-parts">
                {shares.map((share, rank) => (
                    <div key={share.key} className="trend-part">
                        <span className="trend-dot" style={{ background: cssColor(rankColor(rank, share.key === "other")) }} />
                        <span className="trend-name">{share.label}</span>
                        <span className="trend-value">{formatMoney(share.value)}</span>
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

function Buys({ holdings }: { holdings: readonly Holding[] }) {
    const trades = useTrades();
    const held = new Map(holdings.map((holding) => [holding.id, holding]));
    const rows = (trades.data ?? []).flatMap((trade) => {
        const holding = held.get(trade.holdingId);
        return trade.side === "buy" && holding ? [{ trade, holding }] : [];
    });

    if (rows.length === 0) {
        return <span className="portfolio-empty">{trades.isPending ? "Loading buys…" : "No buys recorded yet"}</span>;
    }

    return (
        <ul className="trade-rows">
            {rows.map(({ trade, holding }) => {
                const gain = tradeGainLabel(trade, holding);

                return (
                    <li key={trade.id} className="trade-row trade-static">
                        <span className="trade-symbol">{holding.symbol}</span>
                        <span className="trade-main">
                            <span>{tradeUnits(trade, holding.type)}</span>
                            <span className="trade-note">
                                {dayFormat.format(new Date(trade.day))} · {tradeNote(trade)}
                            </span>
                        </span>
                        <span className="trade-figures">
                            <span>{formatMoney(trade.cost)}</span>
                            <span className={`acct-change ${gain.favourable ? "up" : ""}`}>{gain.text}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

type ModeSwitchProps = {
    mode: Mode;
    className?: string;
    onChange: (mode: Mode) => void;
};

function ModeSwitch({ mode, className, onChange }: ModeSwitchProps) {
    return (
        <div className={`seg chart-modes ${className ?? ""}`}>
            {MODES.map((option) => (
                <label key={option} className="seg-opt">
                    <input
                        type="radio"
                        name="portfolio-mode"
                        checked={mode === option}
                        onChange={() => onChange(option)}
                    />
                    {MODE_LABELS[option]}
                </label>
            ))}
        </div>
    );
}

export function PortfolioChart({ holdings }: { holdings: readonly Holding[] }) {
    const desktop = useDesktop();
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>("allocation");
    const gain = portfolioGain(holdings);
    const chart =
        mode === "allocation" ? (
            <Allocation holdings={holdings} />
        ) : mode === "gains" ? (
            <Gains holdings={holdings} />
        ) : (
            <Buys holdings={holdings} />
        );

    if (desktop) {
        return (
            <div className="panel portfolio-panel">
                <div className="chart-head portfolio-head">
                    <span className="kicker">Portfolio</span>
                    {gain && <GainSummary gain={gain} />}
                    <ModeSwitch mode={mode} onChange={setMode} />
                </div>
                {chart}
            </div>
        );
    }

    return (
        <div className={`acct-card portfolio ${open ? "open" : ""}`}>
            <button className="acct-row" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="acct-name">Portfolio</span>
                {gain && <GainSummary gain={gain} />}
                <span className="acct-caret">›</span>
            </button>

            {open && (
                <div className="portfolio-body">
                    <ModeSwitch mode={mode} className="portfolio-modes" onChange={setMode} />
                    {chart}
                </div>
            )}
        </div>
    );
}
