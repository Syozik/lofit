import type { LucideIcon } from "lucide-react";
import styles from "./tabButton.module.css";

interface TabButtonProps {
    title: string;
    icon: LucideIcon;
    isActive: boolean;
    onClick: () => void;
}

export function TabButton({ title, icon: Icon, isActive, onClick }: TabButtonProps) {
    return (
        <button
            className={`${styles.tabButton}${isActive ? ` ${styles.active}` : ""}`}
            onClick={onClick}
        >
            <Icon className={styles.icon} size={16} strokeWidth={isActive ? 2 : 1.5} aria-hidden />
            <span className={styles.label}>{title}</span>
        </button>
    );
}
