import { signIn, signUp } from "@lofit/api";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const MIN_PASSWORD = 8;

export function SignIn() {
    const [joining, setJoining] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isPasswordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const short = password.length > 0 && password.length < MIN_PASSWORD;
    const blocked =
        pending ||
        !email.trim() ||
        password.length < MIN_PASSWORD ||
        (joining && !name.trim());

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

    return (
        <main className="gate">
            <form
                className="gate-card"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <div className="gate-head">
                    <span className="wordmark">lofit</span>
                    <span className="gate-note">
                        {joining ? "Everything in euros, in one place." : "Welcome back."}
                    </span>
                </div>

                {joining && (
                    <label className="field">
                        <span>Name</span>
                        <input
                            className="input"
                            autoComplete="name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </label>
                )}

                <label className="field">
                    <span>Email</span>
                    <input
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>

                <label className="field">
                    <span>Password</span>
                    <div className="password-wrap">
                        <input
                            className="input"
                            type={isPasswordVisible ? "text" : "password"}
                            autoComplete={joining ? "new-password" : "current-password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                            className="password-toggle"
                            type="button"
                            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                            onClick={() => setPasswordVisible(!isPasswordVisible)}
                        >
                            {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {joining && short && (
                        <span className="gate-hint">At least {MIN_PASSWORD} characters.</span>
                    )}
                </label>

                {error && <span className="gate-error">{error}</span>}

                <button className="btn btn-primary btn-block" type="submit" disabled={blocked}>
                    {pending ? "One moment…" : joining ? "Create account" : "Sign in"}
                </button>

                <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                        setJoining(!joining);
                        setError(null);
                    }}
                >
                    {joining ? "I already have an account" : "Create an account"}
                </button>
            </form>
        </main>
    );
}
