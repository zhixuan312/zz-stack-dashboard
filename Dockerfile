# ZZ Stack — the console of the zz-stack platform.
#
# COUPLED: Node 24 is the floor, as `engines` in package.json says, and `pnpm install` reads
# that field in this image. scripts/ is TypeScript run by Node directly, and native type stripping
# is stable from 24.12.
#
# A standalone Next build: `output: 'standalone'` traces the modules the server reaches and
# copies just those, so the final stage has no node_modules.
#
# It holds no secret and no database URL. For every page its server reads the gateway once, as the person:
# /me, with the caller's own session cookie, at the address in ZZ_GATEWAY, which the container's environment
# must carry (docker-compose.yml requires it). A page's own content is read in the browser, against
# /api/console on the same origin.
#
# The assistant is off unless a deployment sets the ASSISTANT_* variables: /api/assistant then reads the
# gateway as the person asking and calls the model provider. None of them is in the image; without them the
# route answers 404.
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
# The brand's built assets: the wordmark and the mascot's poses. The masters in design/ stay out of the image.
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
