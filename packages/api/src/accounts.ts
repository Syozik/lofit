import { FIXTURE_ACCOUNTS } from "@lofit/domain";
import type { Account } from "@lofit/domain";

export async function fetchAccounts(): Promise<readonly Account[]> {
    return FIXTURE_ACCOUNTS;
}
