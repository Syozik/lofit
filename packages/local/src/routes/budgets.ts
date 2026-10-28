import { budgetLimitSchema } from "@lofit/domain/schemas";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { idParam, invalidBody, readJson } from "../http";
import type { Store } from "../store";

export function budgetsRoute(store: Store) {
    const { data } = store;

    return new Hono()
        .get("/", (c) => {
            const position = new Map(data.tags.map((tag) => [tag.id, tag.position]));
            const rows = data.budgets
                .filter((budget) => position.has(budget.tagId))
                .sort((a, b) => (position.get(a.tagId) ?? 0) - (position.get(b.tagId) ?? 0));

            return c.json(rows.map(({ tagId, limit }) => ({ tagId, limit })));
        })
        .put("/:tagId", async (c) => {
            const tagId = idParam(c, "tagId", "No such tag");
            const parsed = await readJson(c, budgetLimitSchema);
            if (!parsed.success) return invalidBody(c, parsed.error.issues);
            const { limit } = parsed.data;

            if (!data.tags.some((tag) => tag.id === tagId)) {
                throw new HTTPException(404, { message: "No such tag" });
            }

            const budget = { tagId, limit };
            data.budgets = [...data.budgets.filter((entry) => entry.tagId !== tagId), budget];
            await store.save("budgets");

            return c.json(budget);
        })
        .delete("/:tagId", async (c) => {
            const tagId = idParam(c, "tagId", "No such tag");

            data.budgets = data.budgets.filter((entry) => entry.tagId !== tagId);
            await store.save("budgets");

            return c.body(null, 204);
        });
}
