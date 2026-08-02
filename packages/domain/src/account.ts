import { v4 as uuidv4 } from "uuid";
import type { Cents } from "./money";
import type { GroupKey, Position, Provenance } from "./types";

type AccountProps = {
    id?: string;
    name: string;
    subtitle: string;
    group: GroupKey;
    balance: Cents;
    provenance: Provenance;
    lastSyncedAt?: string;
    positions?: readonly Position[];
};

export class Account {
    public id: string;
    public name: string;
    public subtitle: string;
    public group: GroupKey;
    public balance: Cents;
    public provenance: Provenance;
    public lastSyncedAt?: string;
    public positions?: readonly Position[];

    constructor(props: AccountProps) {
        this.id = props.id ?? uuidv4();
        this.name = props.name;
        this.subtitle = props.subtitle;
        this.group = props.group;
        this.balance = props.balance;
        this.provenance = props.provenance;
        if (props.lastSyncedAt) this.lastSyncedAt = props.lastSyncedAt;
        if (props.positions) this.positions = props.positions;
    }
}
