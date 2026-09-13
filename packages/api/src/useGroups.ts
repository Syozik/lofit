import { useQuery } from "@tanstack/react-query";
import { fetchGroups } from "./groups";

export function useGroups() {
    return useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
}
