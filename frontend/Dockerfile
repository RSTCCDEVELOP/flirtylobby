# ---- dev (docker-compose.yml) ----
FROM node:22-alpine AS dev
WORKDIR /app/frontend
COPY package*.json ./
RUN npm install
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
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./.next/static
EXPOSE 5173
CMD ["node", "server.js"]
