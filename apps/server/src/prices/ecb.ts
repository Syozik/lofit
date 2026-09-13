const ENDPOINT = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export interface EcbRates {
    day: string;
    perEuro: Map<string, number>;
}

export async function fetchEcbRates(): Promise<EcbRates | undefined> {
    const response = await fetch(ENDPOINT, { headers: { accept: "application/xml" } });
    if (!response.ok) return undefined;

    const xml = await response.text();
    const day = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
    if (!day) return undefined;

    const perEuro = new Map<string, number>();
    for (const line of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
        const rate = Number(line[2]);
        if (Number.isFinite(rate) && rate > 0) perEuro.set(line[1]!, rate);
    }

    return perEuro.size > 0 ? { day, perEuro } : undefined;
}
