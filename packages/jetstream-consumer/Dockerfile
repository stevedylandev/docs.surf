FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

COPY src ./src
COPY tsconfig.json ./

RUN mkdir -p /app/data

CMD ["bun", "run", "src/index.ts"]
