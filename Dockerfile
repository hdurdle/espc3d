FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://localhost:${ESPC3D_PORT:-3001}/healthz" || exit 1

# Run node directly so it receives SIGTERM from `docker stop`
CMD ["node", "index.js"]
