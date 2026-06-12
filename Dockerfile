FROM eu.gcr.io/blockchain-internal/v1/blockchain_node_20:latest AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# ⚠️⚠️⚠️ MISSING VALUES — GET FROM SRE BEFORE BUILDING ⚠️⚠️⚠️
# These are baked in at build time (next build), NOT read at runtime.
# Replace with the real dev URLs SRE assigns, then build.
ARG NEXT_PUBLIC_API_URL=__MISSING_DEV_API_URL__     # e.g. https://lightning-map-game-api.dev.blockchain.info
ARG NEXT_PUBLIC_WS_URL=__MISSING_DEV_WS_URL__        # e.g. wss://lightning-map-game-api.dev.blockchain.info/ws/lightning/
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
# ⚠️⚠️⚠️ END MISSING VALUES ⚠️⚠️⚠️

RUN npm run build

# ===== runtime stage =====
FROM eu.gcr.io/blockchain-internal/v1/blockchain_node_20:latest

WORKDIR /app
# Copy the built app + only what's needed to run.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER blockchain          # CONFIRM: base image may already set this (uid 1000)

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]