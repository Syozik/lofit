type Crypto = { randomUUID?: () => string };

function fallbackId(): string {
    const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
    hex[12] = "4";
    hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
    const text = hex.join("");
    return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

let generate: () => string = () => (globalThis as { crypto?: Crypto }).crypto?.randomUUID?.() ?? fallbackId();

export function configureIds(next: () => string): void {
    generate = next;
}

export function newId(): string {
    return generate();
}
