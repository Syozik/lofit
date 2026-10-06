FROM node:26-alpine AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g "pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')"
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/domain/package.json packages/domain/
COPY packages/view/package.json packages/view/
RUN pnpm install --frozen-lockfile --filter "@lofit/server..." --filter "@lofit/web..."
COPY . .
RUN pnpm --filter @lofit/web build && pnpm --filter @lofit/server build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_ROOT=web
ENV MIGRATIONS_DIR=./drizzle
ENV PORT=8787
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/server/drizzle ./drizzle
COPY --from=build /repo/apps/web/dist ./web
USER node
EXPOSE 8787
CMD ["node", "dist/server.js"]
