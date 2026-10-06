import type { LucideIcon } from "lucide-react";
import { LogOut, Plus } from "lucide-react";
import type { TabName } from "../navigation";
import { Indicator } from "./indicator";

type Item = {
    label: string;
    Icon: LucideIcon;
};

type Props = {
    items: Record<TabName, Item>;
    current: TabName;
    onSelect: (tab: TabName) => void;
    onAdd: () => void;
    onSignOut: () => void;
};

export function Sidebar({ items, current, onSelect, onAdd, onSignOut }: Props) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <span className="wordmark">lofit</span>
                <Indicator />
            </div>

            <button className="sidebar-add" aria-keyshortcuts="N" onClick={onAdd}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Log entry
                <kbd className="sidebar-kbd" aria-hidden>
                    N
                </kbd>
            </button>

            <nav className="sidebar-nav">
                {(Object.entries(items) as [TabName, Item][]).map(([name, { label, Icon }]) => (
                    <button
                        key={name}
                        className={`sidebar-link ${current === name ? "active" : ""}`}
                        aria-current={current === name ? "page" : undefined}
                        onClick={() => onSelect(name)}
                    >
                        <Icon size={17} strokeWidth={current === name ? 2 : 1.5} aria-hidden />
                        {label}
                    </button>
                ))}
            </nav>

            <button className="sidebar-link sidebar-out" onClick={onSignOut}>
                <LogOut size={16} strokeWidth={1.5} aria-hidden />
                Sign out
            </button>
        </aside>
    );
}
