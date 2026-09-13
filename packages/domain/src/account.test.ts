import { describe, expect, it } from "vitest";
import { restated, sinceLabel } from "./account";
import type { Account } from "./account";
import { euros } from "./money";

const CHECKING: Account = {
    id: "acct-ing",
    name: "ING",
    subtitle: "checking",
    groupId: "g-cash",
    balance: euros(3200),
    provenance: "manual",
};

const LOAN: Account = {
    id: "acct-duo",
    name: "Studieschuld",
    subtitle: "student loan",
    groupId: "g-debt",
    balance: euros(-8750),
    provenance: "manual",
};

const NOW = "2026-10-04T09:30:00Z";
const BEFORE = "2026-10-02T08:00:00Z";

describe("restated", () => {
    it("takes the new balance and stamps when it was stated", () => {
        const account = restated(CHECKING, euros(3430), NOW, BEFORE);

        expect(account.balance).toBe(euros(3430));
        expect(account.statedAt).toBe(NOW);
    });

    it("reports the rise since the last time it was stated", () => {
        const account = restated(CHECKING, euros(3430), NOW, BEFORE);

        expect(account.change).toStrictEqual({
            amount: euros(230),
            period: "since 2 Oct",
            favourable: true,
        });
    });

    it("counts a fall as unfavourable", () => {
        const account = restated(CHECKING, euros(2900), NOW, BEFORE);

        expect(account.change?.amount).toBe(euros(-300));
        expect(account.change?.favourable).toBe(false);
    });

    it("treats owing less as favourable, because debt is held negative", () => {
        const account = restated(LOAN, euros(-8000), NOW, BEFORE);

        expect(account.change?.amount).toBe(euros(750));
        expect(account.change?.favourable).toBe(true);
    });

    it("treats owing more as unfavourable", () => {
        const account = restated(LOAN, euros(-9000), NOW, BEFORE);

        expect(account.change?.amount).toBe(euros(-250));
        expect(account.change?.favourable).toBe(false);
    });

    it("calls an unchanged balance favourable rather than a loss", () => {
        const account = restated(CHECKING, euros(3200), NOW, BEFORE);

        expect(account.change?.amount).toBe(euros(0));
        expect(account.change?.favourable).toBe(true);
    });

    it("leaves the rest of the account alone", () => {
        const account = restated(CHECKING, euros(3430), NOW, BEFORE);

        expect(account.name).toBe("ING");
        expect(account.groupId).toBe("g-cash");
        expect(account.provenance).toBe("manual");
    });
});

describe("sinceLabel", () => {
    it("reads as a short day in UTC", () => {
        expect(sinceLabel("2026-01-09T23:30:00Z")).toBe("since 9 Jan");
    });
});
