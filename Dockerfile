FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV SETLIST_BOOTH_HOST=0.0.0.0
EXPOSE 3847
EXPOSE 3848
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
