import { Tabs } from "expo-router";
import { ChartPie, Receipt, WalletCards } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, fonts } from "../../theme";

function icon(Icon: LucideIcon) {
    return ({ focused }: { focused: boolean }) => (
        <Icon size={20} strokeWidth={1.5} color={focused ? colors.accent : colors.muted} />
    );
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: colors.bg },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.muted,
                tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
                tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.hairline },
            }}
        >
            <Tabs.Screen name="index" options={{ title: "Net worth", tabBarIcon: icon(ChartPie) }} />
            <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: icon(WalletCards) }} />
            <Tabs.Screen name="spending" options={{ title: "Spending", tabBarIcon: icon(Receipt) }} />
        </Tabs>
    );
}
