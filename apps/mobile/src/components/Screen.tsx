import type { ReactNode } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { ListRenderItem } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurSource, useTabBarSpace } from "../tabBar";
import type { Colors } from "../theme";
import { fonts, space, useStyles, useTheme } from "../theme";
import { AppHeader } from "./AppHeader";

type Props = {
    children: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
};

export function Screen({ children, refreshing = false, onRefresh }: Props) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const tabBar = useTabBarSpace();

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <BlurSource>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: tabBar + 24 }]}
                    refreshControl={
                        onRefresh ? (
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                            />
                        ) : undefined
                    }
                >
                    <AppHeader />
                    {children}
                </ScrollView>
            </BlurSource>
        </SafeAreaView>
    );
}

type ListProps<T> = {
    header: ReactNode;
    data: readonly T[];
    renderItem: ListRenderItem<T>;
    keyExtractor: (item: T) => string;
    empty?: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
};

export function ListScreen<T>({ header, data, renderItem, keyExtractor, empty, refreshing = false, onRefresh }: ListProps<T>) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const tabBar = useTabBarSpace();

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <BlurSource>
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={
                        <View style={styles.listHead}>
                            <AppHeader />
                            {header}
                        </View>
                    }
                    ListEmptyComponent={empty ? <>{empty}</> : undefined}
                    contentContainerStyle={[styles.list, { paddingBottom: tabBar + 24 }]}
                    initialNumToRender={12}
                    windowSize={7}
                    refreshControl={
                        onRefresh ? (
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                            />
                        ) : undefined
                    }
                />
            </BlurSource>
        </SafeAreaView>
    );
}

export function Status({ text, busy = false }: { text: string; busy?: boolean }) {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    return (
        <View style={styles.status}>
            {busy && <ActivityIndicator color={colors.accent} />}
            <Text style={styles.statusText}>{text}</Text>
        </View>
    );
}

export const makeText = (colors: Colors) =>
    StyleSheet.create({
        kicker: {
            fontFamily: fonts.medium,
            fontSize: 10.5,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: colors.muted,
        },
        body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
        muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    });

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },
        content: { paddingHorizontal: 20, gap: space[8] },
        list: { paddingHorizontal: 20 },
        listHead: { gap: space[8], marginBottom: space[3] },
        status: { paddingVertical: 60, alignItems: "center", gap: 10 },
        statusText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
    });
