# ==========================================
# 多阶段构建 - 构建阶段
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 安装依赖
COPY package*.json ./
RUN npm ci

# 安装 Prisma 依赖
RUN npm install prisma --no-save

# 复制源代码
COPY prisma ./prisma
COPY server ./server
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# 生成 Prisma Client
RUN npx prisma generate

# 构建前端
RUN npm run build

# ==========================================
# 生产阶段
# ==========================================
FROM node:20-slim AS production

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN addgroup --gid 1001 nodejs && \
    adduser --system --uid 1001 agenthub

# 从构建阶段复制内容
COPY --from=builder --chown=agenthub:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=agenthub:nodejs /app/package*.json ./
COPY --from=builder --chown=agenthub:nodejs /app/prisma ./prisma
COPY --from=builder --chown=agenthub:nodejs /app/server ./server
COPY --from=builder --chown=agenthub:nodejs /app/dist ./dist

# 创建必要目录
RUN mkdir -p /app/logs && \
    mkdir -p /app/data && \
    chown -R agenthub:nodejs /app

USER agenthub

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动命令
CMD ["node", "server/index.js"]
