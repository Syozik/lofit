import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onSyncIssue } from "../syncIssues";
import { TAB_BAR_HEIGHT } from "../tabBar";
import type { Colors } from "../theme";
import { fonts, radius, useStyles } from "../theme";

export type ToastAction = { label: string; run: () => void };

type Show = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

const VISIBLE_MS = 4000;

export function useToast(): Show {
    return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const styles = useStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const [toast, setToast] = useState<{
        message: string;
        action?: ToastAction;
        id: number;
    } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [toast]);

    const show = useCallback<Show>((message, action) => {
        setToast(action ? { message, action, id: Date.now() } : { message, id: Date.now() });
    }, []);

    useEffect(() => onSyncIssue((message) => show(message)), [show]);

    return (
        <ToastContext.Provider value={show}>
            {children}
            {toast && (
                <View
                    style={[styles.toast, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}
                    pointerEvents="box-none"
                >
                    <Text style={styles.message} numberOfLines={2}>
                        {toast.message}
                    </Text>
                    {toast.action && (
                        <Pressable
                            hitSlop={8}
                            onPress={() => {
                                toast.action?.run();
                                setToast(null);
                            }}
                        >
                            <Text style={styles.action}>{toast.action.label}</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </ToastContext.Provider>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        toast: {
            position: "absolute",
            left: 16,
            right: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radius.md,
            backgroundColor: colors.text,
            elevation: 8,
        },
        message: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.surface },
        action: { fontFamily: fonts.medium, fontSize: 13, color: colors.toastAction },
    });
