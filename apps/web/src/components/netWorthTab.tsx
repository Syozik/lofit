import { useAccounts } from "@lofit/api";
import { formatEuros, sumCents } from "@lofit/domain";

export function NetWorthTab() {
    const { data: accounts, isPending, isError } = useAccounts();

    if (isPending) return <div className="tab-content">Loading…</div>;
    if (isError) return <div className="tab-content">Could not load accounts</div>;
    const total = sumCents(accounts.map((account) => account.balance));
    return (
        <div className="tab-content">
            <div>All: {formatEuros(total)}</div>
            {accounts.map((account) => (
                <div key={account.id}>
                    {account.name} {formatEuros(account.balance)}
                </div>
            ))}
        </div>
    );
}
