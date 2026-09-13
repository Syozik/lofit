import { useQuery } from "@tanstack/react-query";
import { fetchTags } from "./tags";

export function useTags() {
    return useQuery({ queryKey: ["tags"], queryFn: fetchTags });
}
