import styles from "./tabButton.module.css";

interface TabButtonProps {
    title: string;
    icon?: string;
    isActive: boolean;
    onClick: () => void;
}

export function TabButton({ title, isActive, icon, onClick }: TabButtonProps) {
    console.log(icon);
    return (
        <button
            className={`${styles.tabButton}${isActive ? ` ${styles.active}` : ""}`}
            onClick={onClick}
        >
            {title}
        </button>
    );
}
