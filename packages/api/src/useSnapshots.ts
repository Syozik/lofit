import { useQuery } from "@tanstack/react-query";
import { fetchSnapshots } from "./snapshots";

export function useSnapshots() {
    return useQuery({ queryKey: ["snapshots"], queryFn: fetchSnapshots });
}
