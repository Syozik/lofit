import { signOut, useSession } from "@lofit/api";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ChartPie, LogOut, Plus, Receipt, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./App.css";
import { EntrySheet } from "./components/entrySheet";
import { SignIn } from "./components/signIn";
import { NetWorthTab } from "./components/netWorthTab";
import { AccountsTab } from "./components/accountsTab";
import { SpendingTab } from "./components/spendingTab";
import { TabButton } from "./components/tabButton";
import { Indicator } from "./components/indicator";
import { NavigationContext } from "./navigation";
import type { TabName } from "./navigation";
import { ToastContext } from "./toast";
import type { ToastAction } from "./toast";

type Tab = {
    label: string;
    Icon: LucideIcon;
    Component: React.FC;
};

const TABS: Record<TabName, Tab> = {
    netWorth: { label: "Net worth", Icon: ChartPie, Component: NetWorthTab },
    accounts: { label: "Accounts", Icon: WalletCards, Component: AccountsTab },
    spending: { label: "Spending", Icon: Receipt, Component: SpendingTab },
};

const TOAST_MS = 1000;

function AppShell() {
    const queryClient = useQueryClient();
    const [currentTab, setCurrentTab] = useState<TabName>("netWorth");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null);
    const ActiveTab = TABS[currentTab].Component;

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_MS);
        return () => clearTimeout(timer);
    }, [toast]);

    const show = useCallback(
        (message: string, action?: ToastAction) =>
            setToast(action ? { message, action } : { message }),
        [],
    );

    async function leave() {
        await signOut();
        queryClient.clear();
    }

    return (
        <NavigationContext.Provider value={setCurrentTab}>
            <ToastContext.Provider value={show}>
                <main className="main-container">
                    <div className="app-header">
                        <span className="wordmark">lofit</span>
                        <Indicator />
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ marginLeft: "auto" }}
                            aria-label="Sign out"
                            onClick={() => void leave()}
                        >
                            <LogOut size={16} strokeWidth={1.5} aria-hidden />
                        </button>
                    </div>
                    <ActiveTab />
                    <div className="tabs">
                        {Object.entries(TABS).map(([name, tab]) => (
                            <TabButton
                                key={name}
                                title={tab.label}
                                icon={tab.Icon}
                                onClick={() => setCurrentTab(name as TabName)}
                                isActive={currentTab === name}
                            />
                        ))}
                        <button
                            className="tab-add"
                            aria-label="Log an entry"
                            onClick={() => setSheetOpen(true)}
                        >
                            <Plus size={22} strokeWidth={1.5} aria-hidden />
                        </button>
                    </div>

                    {toast && (
                        <div className="toast">
                            <span>{toast.message}</span>
                            {toast.action && (
                                <button
                                    className="btn btn-ghost toast-action"
                                    onClick={() => {
                                        toast.action?.run();
                                        setToast(null);
                                    }}
                                >
                                    {toast.action.label}
                                </button>
                            )}
                        </div>
                    )}

                    {sheetOpen && <EntrySheet onClose={() => setSheetOpen(false)} onSaved={show} />}
                </main>
            </ToastContext.Provider>
        </NavigationContext.Provider>
    );
}

function App() {
    const { data: session, isPending } = useSession();

    if (isPending) return <main className="gate" />;
    if (!session) return <SignIn />;

    return <AppShell />;
}

export default App;
