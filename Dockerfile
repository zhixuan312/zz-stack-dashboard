# ZZ Console — the admin dashboard.
#
# A standalone Next build, which is why there are two stages and no node_modules
# in the final image: `output: 'standalone'` traces the modules the server
# actually reaches and copies just those, so the runtime layer is the app plus
# what it imports rather than the whole dependency tree.
#
# IT HOLDS NO SECRET AND TALKS TO NOTHING. Every read the console does happens in
# the browser, against /api/console on the same origin, carrying the person's own
# cookie. This container serves HTML and JavaScript and has no database URL, no
# token and no upstream — which is the property that makes deploying it beside
# the gateway uninteresting rather than delicate.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
# Manifest and lockfile first: this layer is the install, and it should be reused
# on every build where the dependencies have not moved.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Fails the build on a type error rather than shipping one — `next build` runs
# tsc, and the whole point of catching it here is that the container is the
# artifact everything downstream trusts.
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
# Not root. Nothing in here needs to write anywhere, so the runtime user owns
# nothing and the filesystem stays as the build left it.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
