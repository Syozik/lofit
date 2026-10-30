import { useDisplayCurrency, useSession } from "@lofit/api";
import { isCurrency } from "@lofit/domain";
import type { Transaction } from "@lofit/domain";
import { Tabs } from "expo-router";
import { ChartPie, Plus, Receipt, WalletCards } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntrySheet } from "../../components/EntrySheet";
import { EntryContext } from "../../context/entry";
import { useGuest } from "../../mode";
import { BlurTargetsProvider, TAB_BAR_HEIGHT, TabBarBackground } from "../../tabBar";
import type { Colors } from "../../theme";
import { fonts, useStyles, useTheme } from "../../theme";

function icon(Icon: LucideIcon, colors: Colors) {
    return ({ focused }: { focused: boolean }) => (
        <Icon size={20} strokeWidth={1.5} color={focused ? colors.accent : colors.muted} />
    );
}

type Entry = { entry?: Transaction | undefined } | null;

function useSignedUpCurrency() {
    const session = useSession();
    const currency = useGuest() ? undefined : session.data?.user.currency;
    return isCurrency(currency) ? currency : undefined;
}

export default function TabsLayout() {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const [entry, setEntry] = useState<Entry>(null);
    const currency = useDisplayCurrency(useSignedUpCurrency());

    return (
        <EntryContext.Provider value={(transaction) => setEntry({ entry: transaction })}>
            <BlurTargetsProvider>
                <Tabs
                    key={currency}
                    screenOptions={{
                        headerShown: false,
                        sceneStyle: { backgroundColor: colors.bg },
                        tabBarActiveTintColor: colors.accent,
                        tabBarInactiveTintColor: colors.muted,
                        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
                        tabBarStyle: {
                            position: "absolute",
                            height: TAB_BAR_HEIGHT + insets.bottom,
                            backgroundColor: "transparent",
                            borderTopColor: colors.hairline,
                            elevation: 0,
                        },
                        tabBarBackground: () => <TabBarBackground />,
                    }}
                >
                    <Tabs.Screen name="index" options={{ title: "Net worth", tabBarIcon: icon(ChartPie, colors) }} />
                    <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: icon(WalletCards, colors) }} />
                    <Tabs.Screen name="spending" options={{ title: "Spending", tabBarIcon: icon(Receipt, colors) }} />
                    <Tabs.Screen
                        name="add"
                        options={{
                            title: "Log an entry",
                            tabBarButton: () => (
                                <View style={styles.addSlot}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Log an entry"
                                        onPress={() => setEntry({})}
                                        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
                                    >
                                        <Plus size={22} strokeWidth={1.5} color={colors.accent} />
                                    </Pressable>
                                </View>
                            ),
                        }}
                    />
                </Tabs>
            </BlurTargetsProvider>
            {entry && <EntrySheet entry={entry.entry} onClose={() => setEntry(null)} />}
        </EntryContext.Provider>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        addSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
        add: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentWash,
            borderWidth: 1,
            borderColor: colors.accent,
        },
        pressed: { opacity: 0.8 },
    });
