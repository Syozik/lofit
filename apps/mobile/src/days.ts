export function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function toInstant(day: string): string {
    return `${day}T${new Date().toISOString().slice(11)}`;
}
