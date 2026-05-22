#!/bin/bash

# ============================================
# AgentHub 数据库迁移和初始化脚本
# ============================================

echo "🚀 AgentHub 数据库初始化开始..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker 和 Docker Compose"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "📦 启动 PostgreSQL 数据库..."

# 使用 Docker Compose 启动 PostgreSQL
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres
else
    docker compose up -d postgres
fi

echo "⏳ 等待数据库启动..."

# 等待数据库就绪
MAX_RETRIES=30
RETRY_COUNT=0

until docker exec agenthub-postgres pg_isready -U agenthub &> /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ 数据库启动超时"
        exit 1
    fi
    echo "  等待中... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "✅ 数据库已就绪！"
echo ""

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "📄 创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请根据需要修改 .env 文件中的配置"
fi

echo "🗄️  运行 Prisma 迁移..."
npx prisma migrate deploy

echo "🌱 运行数据库种子..."
npx prisma db seed

echo ""
echo "=============================================="
echo "✅ 数据库初始化完成！"
echo ""
echo "📊 数据库信息："
echo "  - Host: localhost:5432"
echo "  - Database: agenthub"
echo "  - Username: agenthub"
echo ""
echo "🔍 Adminer (数据库管理界面):"
echo "  - URL: http://localhost:8080"
echo "  - 系统: PostgreSQL"
echo "  - 服务器: postgres"
echo "  - 用户名: agenthub"
echo "  - 密码: agenthub_password"
echo "  - 数据库: agenthub"
echo ""
echo "🚀 启动完整应用（包括前端和后端）："
echo "  npm run dev"
echo ""
echo "🚀 仅启动数据库："
echo "  docker-compose up -d postgres"
echo ""
echo "🚀 启动数据库和 Adminer："
echo "  docker-compose up -d"
echo ""
echo "=============================================="
