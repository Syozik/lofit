import { newTagSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { idParam, invalidBody, readJson } from "../http";
import { newId } from "../ids";
import type { Store } from "../store";

function sameName(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

export function tagsRoute(store: Store) {
    const { data } = store;

    return new Hono()
        .get("/", (c) => c.json([...data.tags].sort((a, b) => a.position - b.position)))
        .post("/", async (c) => {
            const parsed = await readJson(c, newTagSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const { id, name, kind } = parsed.data;

            if (id) {
                const same = data.tags.find((tag) => tag.id === id);
                if (same) return c.json(same, 200);
            }

            const existing = data.tags.find((tag) => tag.kind === kind && sameName(tag.name, name));
            if (existing) return c.json(existing, 200);

            const position = data.tags.reduce((end, tag) => Math.max(end, tag.position + 1), 0);
            const created = { id: id ?? newId(), name, kind, position };
            data.tags.push(created);
            await store.save("tags");

            return c.json(created, 201);
        })
        .patch("/:id", async (c) => {
            const id = idParam(c, "id", "No such tag");
            const parsed = await readJson(c, newTagSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const { name } = parsed.data;

            const index = data.tags.findIndex((tag) => tag.id === id);
            const current = data.tags[index];
            if (!current) throw new HTTPException(404, { message: "No such tag" });

            const clash = data.tags.some(
                (tag) => tag.kind === current.kind && tag.id !== id && sameName(tag.name, name),
            );
            if (clash) throw new HTTPException(409, { message: `A tag named ${name} already exists` });

            const renamed = { ...current, name };
            data.tags[index] = renamed;
            await store.save("tags");

            return c.json(renamed);
        });
}
