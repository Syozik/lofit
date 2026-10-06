import type { Transaction } from "@lofit/domain";
import { createContext, useContext } from "react";

export type OpenEntry = (entry?: Transaction) => void;

export const EntryContext = createContext<OpenEntry>(() => {});

export function useOpenEntry(): OpenEntry {
    return useContext(EntryContext);
}
