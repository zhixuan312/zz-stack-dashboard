# ZZ Console — the admin dashboard.
#
# COUPLED: Node 24 is the floor, as `engines` in package.json says, and `pnpm install` reads
# that field in this image. scripts/ and checks/ are TypeScript run by Node directly, and native
# type stripping is stable from 24.12.
#
# A standalone Next build: `output: 'standalone'` traces the modules the server reaches and
# copies just those, so the final stage has no node_modules.
#
# It holds no secret and talks to nothing. Every read happens in the browser, against
# /api/console on the same origin with the person's own cookie; this container serves HTML and
# JavaScript and has no database URL, no token and no upstream.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
# Manifest and lockfile first, so the install layer is reused while dependencies stay put.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# `next build` runs tsc, so a type error fails the image build.
RUN pnpm build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
# Not root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
