import { createContext, useContext } from "react";

export type ToastAction = {
    label: string;
    run: () => void;
};

export type ShowToast = (message: string, action?: ToastAction) => void;

export const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
    return useContext(ToastContext);
}
