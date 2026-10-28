import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Colors } from "../theme";
import { fonts, radius, space, useStyles } from "../theme";

const CLOSE_DISTANCE = 96;
const CLOSE_SPEED = 900;
const SETTLE_MS = 200;

type Props = {
    title: string;
    note?: string | undefined;
    action?: { label: string; onPress: () => void } | undefined;
    onClose: () => void;
    children: ReactNode;
};

export function Sheet({ title, note, action, onClose, children }: Props) {
    const styles = useStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const offset = useRef(new Animated.Value(Dimensions.get("window").height)).current;

    useEffect(() => {
        Animated.timing(offset, {
            toValue: 0,
            duration: SETTLE_MS * 1.2,
            useNativeDriver: true,
        }).start();
    }, [offset]);

    function dismiss() {
        Animated.timing(offset, {
            toValue: Dimensions.get("window").height,
            duration: SETTLE_MS,
            useNativeDriver: true,
        }).start(() => onClose());
    }

    const drag = Gesture.Pan()
        .runOnJS(true)
        .onUpdate((event) => offset.setValue(Math.max(0, event.translationY)))
        .onEnd((event) => {
            if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_SPEED) dismiss();
            else
                Animated.spring(offset, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 0,
                }).start();
        });

    const scrim = offset.interpolate({
        inputRange: [0, 400],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={dismiss}
        >
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[styles.scrim, { opacity: scrim }]}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        accessibilityLabel="Close"
                        onPress={dismiss}
                    />
                </Animated.View>
                <KeyboardAvoidingView
                    behavior="padding"
                    style={styles.layer}
                    pointerEvents="box-none"
                >
                    <Animated.View style={[styles.sheet, { transform: [{ translateY: offset }] }]}>
                        <GestureDetector gesture={drag}>
                            <View style={styles.handleArea}>
                                <View style={styles.grip} />
                                <View style={styles.head}>
                                    <Text style={styles.title} numberOfLines={1}>
                                        {title}
                                    </Text>
                                    {note && (
                                        <Text style={styles.note} numberOfLines={2}>
                                            {note}
                                        </Text>
                                    )}
                                    {action && (
                                        <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress} style={styles.actionButton}>
                                            <Text style={styles.action}>{action.label}</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </GestureDetector>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={[
                                styles.body,
                                { paddingBottom: insets.bottom + 24 },
                            ]}
                        >
                            {children}
                        </ScrollView>
                    </Animated.View>
                </KeyboardAvoidingView>
            </GestureHandlerRootView>
        </Modal>
    );
}

export function SheetActions({ children }: { children: ReactNode }) {
    const styles = useStyles(makeStyles);
    return <View style={styles.actions}>{children}</View>;
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        root: { flex: 1 },
        scrim: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.scrim,
        },
        layer: { flex: 1, justifyContent: "flex-end" },
        sheet: {
            maxHeight: "92%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            elevation: 16,
        },
        handleArea: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: space[4] },
        grip: {
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.chip,
            marginBottom: 12,
        },
        head: { flexDirection: "row", alignItems: "baseline", gap: 10 },
        title: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 18, color: colors.text },
        note: {
            flex: 1,
            textAlign: "right",
            fontFamily: fonts.regular,
            fontSize: 11,
            color: colors.muted,
        },
        actionButton: { marginLeft: "auto" },
        action: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
        body: { paddingHorizontal: 20, gap: space[6] },
        actions: { flexDirection: "row", gap: 10 },
    });
