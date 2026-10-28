import { signIn, signUp } from "@lofit/api";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { setMode } from "../mode";
import { forgetCache } from "../queryClient";
import type { Colors } from "../theme";
import { fonts, radius, space, useStyles, useTheme } from "../theme";

const MIN_PASSWORD = 8;

export default function SignInScreen() {
    const { colors } = useTheme();
    const styles = useStyles(makeStyles);
    const [joining, setJoining] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const client = useQueryClient();

    const short = password.length > 0 && password.length < MIN_PASSWORD;
    const blocked =
        pending || !email.trim() || password.length < MIN_PASSWORD || (joining && !name.trim());

    async function submit() {
        if (blocked) return;

        setPending(true);
        setError(null);
        try {
            if (joining) await signUp(name.trim(), email.trim(), password);
            else await signIn(email.trim(), password);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }

    async function enterGuest() {
        await forgetCache(client, "account");
        await setMode("guest");
    }

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView style={styles.screen} behavior="height">
                <ScrollView
                    contentContainerStyle={styles.center}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.card}>
                        <View style={styles.head}>
                            <Text style={styles.wordmark}>lofit</Text>
                            <Text style={styles.note}>
                                {joining ? "All your financials, in one place." : "Welcome back."}
                            </Text>
                        </View>

                        {joining && (
                            <Field
                                label="Name"
                                value={name}
                                onChangeText={setName}
                                autoComplete="name"
                            />
                        )}

                        <Field
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoComplete="email"
                            importantForAutofill="yes"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <Field
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            autoComplete={joining ? "new-password" : "current-password"}
                            importantForAutofill="yes"
                            secureTextEntry={!visible}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onSubmitEditing={() => void submit()}
                            hint={
                                joining && short
                                    ? `At least ${MIN_PASSWORD} characters.`
                                    : undefined
                            }
                            trailing={
                                <Pressable
                                    accessibilityLabel={visible ? "Hide password" : "Show password"}
                                    hitSlop={8}
                                    onPress={() => setVisible(!visible)}
                                >
                                    {visible ? (
                                        <EyeOff size={16} color={colors.quiet} />
                                    ) : (
                                        <Eye size={16} color={colors.quiet} />
                                    )}
                                </Pressable>
                            }
                        />

                        {error && <Text style={styles.error}>{error}</Text>}

                        <Button
                            label={pending ? "One moment…" : joining ? "Create account" : "Sign in"}
                            disabled={blocked}
                            onPress={() => void submit()}
                        />
                        {joining ? (
                            <Button
                                variant="ghost"
                                label="I already have an account"
                                onPress={() => {
                                    setJoining(false);
                                    setError(null);
                                }}
                            />
                        ) : (
                            <>
                                <View style={styles.rule} />
                                <Text style={styles.ask}>Don't have an account?</Text>
                                <View style={styles.choices}>
                                    <Button
                                        variant="secondary"
                                        label="Create account"
                                        disabled={pending}
                                        style={styles.choice}
                                        labelStyle={styles.choiceLabel}
                                        onPress={() => {
                                            setJoining(true);
                                            setError(null);
                                        }}
                                    />
                                    <Button
                                        variant="secondary"
                                        label="Use lofit offline"
                                        disabled={pending}
                                        style={styles.choice}
                                        labelStyle={styles.choiceLabel}
                                        onPress={() => void enterGuest()}
                                    />
                                </View>
                            </>
                        )}
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const makeStyles = (colors: Colors) =>
    StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },
        center: { flexGrow: 1, justifyContent: "center", padding: 20 },
        card: {
            gap: space[6],
            padding: 22,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.hairline,
        },
        head: { gap: 4, marginBottom: 4 },
        wordmark: { fontFamily: fonts.semibold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
        note: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
        error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
        rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginTop: space[1] },
        ask: {
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.muted,
            textAlign: "center",
            marginTop: -space[1],
        },
        choices: { flexDirection: "row", gap: space[3], marginTop: -space[2] },
        choice: { flex: 1, minHeight: 38, paddingHorizontal: 8 },
        choiceLabel: { fontFamily: fonts.regular, fontSize: 13 },
    });
