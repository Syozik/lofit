import { newGroupSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { invalidBody, readJson } from "../http";
import { newId } from "../ids";
import type { Store } from "../store";

export function groupsRoute(store: Store) {
    const { data } = store;

    return new Hono()
        .get("/", (c) => c.json([...data.groups].sort((a, b) => a.position - b.position)))
        .post("/", async (c) => {
            const parsed = await readJson(c, newGroupSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const { id, name } = parsed.data;

            if (id) {
                const same = data.groups.find((group) => group.id === id);
                if (same) return c.json(same, 200);
            }

            const existing = data.groups.find((group) => group.name.toLowerCase() === name.toLowerCase());
            if (existing) return c.json(existing, 200);

            const position = data.groups.reduce((end, group) => Math.max(end, group.position + 1), 0);
            const created = { id: id ?? newId(), name, position, invests: false };
            data.groups.push(created);
            await store.save("groups");

            return c.json(created, 201);
        });
}
