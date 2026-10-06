type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function reportSyncIssue(message: string): void {
    listeners.forEach((listener) => listener(message));
}

export function onSyncIssue(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
