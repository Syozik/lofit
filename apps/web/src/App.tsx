import { useState } from "react";
import "./App.css";
import { NetWorthTab } from "./components/netWorthTab";
import { AccountsTab } from "./components/accountsTab";
import { SpendingTab } from "./components/spendingTab";
import { TabButton } from "./components/tabButton";
import { Indicator } from "./components/indicator";
import { MonthDate } from "./components/month_date";

type TabName = "netWorth" | "accounts" | "spending";

const tabs: Record<TabName, React.FC> = {
    netWorth: NetWorthTab,
    accounts: AccountsTab,
    spending: SpendingTab,
};

function App() {
    const [currentTab, setCurrentTab] = useState<TabName>("netWorth");
    const ActiveTab = tabs[currentTab];
    return (
        <main className="main-container">
            <div className="app-header">
                <span className="wordmark">lofit</span>
                <Indicator />
                <MonthDate />
            </div>
            <ActiveTab />
            <div className="tabs">
                {Object.keys(tabs).map((tab) => (
                    <TabButton
                        key={tab}
                        title={tab}
                        onClick={() => setCurrentTab(tab as TabName)}
                        isActive={currentTab === tab}
                    />
                ))}
            </div>
        </main>
    );
}

export default App;
