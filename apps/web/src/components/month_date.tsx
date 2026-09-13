import { monthName, yearOf } from "../period";
import styles from "./month_date.module.css";

type Props = {
    period: string;
};

export function MonthDate({ period }: Props) {
    return <div className={styles.date}>{`${monthName(period, "long")} ${yearOf(period)}`}</div>
}
