import styles from "./month_date.module.css";

export function MonthDate() {
    const date = new Date();
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
    const year = date.getFullYear();

    return <div className={styles.date}>{`${month} ${year}`}</div>
}
