# ---- dev (docker-compose.yml) ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
# Use the committed lockfile exactly, so every deployment has the same dependency tree.
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build ----
FROM dev AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---- production (default last stage) ----
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production PORT=5173 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Next.js serves root-relative static assets (such as /logo-rstcc.png) from public/.
COPY --from=build /app/public ./public
EXPOSE 5173
CMD ["node", "server.js"]
