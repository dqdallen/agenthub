#!/bin/bash

# 数据库切换脚本
# 用法：
#   ./switch-db.sh sqlite  - 切换到 SQLite（本地开发）
#   ./switch-db.sh postgresql - 切换到 PostgreSQL（生产环境）

PROVIDER=$1

if [ -z "$PROVIDER" ]; then
    echo "用法: ./switch-db.sh [sqlite|postgresql]"
    exit 1
fi

if [ "$PROVIDER" = "sqlite" ]; then
    # 切换到 SQLite
    sed -i 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    # 修改 .env
    sed -i 's/DATABASE_PROVIDER=postgresql/DATABASE_PROVIDER=sqlite/' .env
    sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' .env
    
    echo "✅ 已切换到 SQLite"
    echo "运行 'npx prisma db push' 来同步数据库"
elif [ "$PROVIDER" = "postgresql" ]; then
    # 切换到 PostgreSQL
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
    # 修改 .env（需要手动设置 DATABASE_URL）
    
    echo "✅ 已切换到 PostgreSQL"
    echo "请确保 .env 中的 DATABASE_URL 指向你的 PostgreSQL 数据库"
else
    echo "错误: 未知的数据库类型 '$PROVIDER'"
    echo "支持的类型: sqlite, postgresql"
    exit 1
fi
