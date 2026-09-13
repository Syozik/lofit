import { createContext, useContext } from "react";

export type TabName = "netWorth" | "accounts" | "spending";

export const NavigationContext = createContext<(tab: TabName) => void>(() => {});

export function useNavigate() {
    return useContext(NavigationContext);
}
