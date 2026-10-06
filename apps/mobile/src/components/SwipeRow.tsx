import { Pencil, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "../theme";

const ACTION_WIDTH = 64;

type Props = {
    label: string;
    onEdit?: (() => void) | undefined;
    onDelete: () => void;
    children: ReactNode;
};

export function SwipeRow({
    label,
    onEdit,
    onDelete,
    children,
    surface = colors.bg,
}: Props & { surface?: string }) {
    const swipe = useRef<SwipeableMethods>(null);

    const run = (action: () => void) => () => {
        swipe.current?.close();
        action();
    };

    return (
        <ReanimatedSwipeable
            ref={swipe}
            friction={1.6}
            rightThreshold={ACTION_WIDTH / 2}
            overshootRight={false}
            renderRightActions={() => (
                <View style={[styles.actions, { width: ACTION_WIDTH * (onEdit ? 2 : 1) }]}>
                    {onEdit && (
                        <Pressable
                            accessibilityLabel={`Edit ${label}`}
                            style={styles.action}
                            onPress={run(onEdit)}
                        >
                            <Pencil size={16} strokeWidth={1.5} color={colors.quiet} />
                        </Pressable>
                    )}
                    <Pressable
                        accessibilityLabel={`Delete ${label}`}
                        style={styles.action}
                        onPress={run(onDelete)}
                    >
                        <Trash2 size={16} strokeWidth={1.5} color={colors.danger} />
                    </Pressable>
                </View>
            )}
        >
            <View style={{ backgroundColor: surface }}>{children}</View>
        </ReanimatedSwipeable>
    );
}

const styles = StyleSheet.create({
    actions: { flexDirection: "row" },
    action: {
        width: ACTION_WIDTH,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.chip,
    },
});
