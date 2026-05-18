#!/bin/bash

# ===========================================
# AgentHub 数据库迁移脚本
# ===========================================
# 功能：
# 1. 初始化开发数据库
# 2. 运行生产数据库迁移
# 3. 备份和恢复数据库
# ===========================================

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
APP_DIR="/var/www/agenthub"
DB_PATH="$APP_DIR/prisma/dev.db"
BACKUP_DIR="/var/backups/agenthub"

# 函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 .env 文件
check_env() {
    if [ ! -f "$APP_DIR/.env" ]; then
        log_error ".env 文件不存在！"
        log_info "请创建 .env 文件或复制 .env.production 作为模板"
        exit 1
    fi
}

# 开发环境初始化
dev_init() {
    log_info "初始化开发数据库..."
    
    cd $APP_DIR
    
    # 生成 Prisma Client
    npx prisma generate
    
    # 推送 schema 到数据库
    npx prisma db push
    
    # 运行种子数据（可选）
    if [ "$1" = "--seed" ]; then
        log_info "填充种子数据..."
        npx prisma db seed
    fi
    
    log_info "开发数据库初始化完成"
}

# 生产环境迁移
prod_migrate() {
    log_info "运行生产数据库迁移..."
    
    check_env
    cd $APP_DIR
    
    # 生成 Prisma Client
    npx prisma generate
    
    # 运行迁移
    npx prisma migrate deploy
    
    log_info "生产数据库迁移完成"
}

# 备份数据库
backup() {
    log_info "备份数据库..."
    
    mkdir -p $BACKUP_DIR
    
    # 获取数据库 URL
    source $APP_DIR/.env
    
    # SQLite 备份
    if [[ $DATABASE_URL == *"sqlite"* ]]; then
        DATE=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.db"
        
        cp $DB_PATH $BACKUP_FILE
        gzip $BACKUP_FILE
        
        log_info "备份已保存: $BACKUP_FILE.gz"
    else
        # PostgreSQL 备份
        DATE=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"
        
        # 从 DATABASE_URL 提取参数
        DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
        DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        
        PGPASSWORD=$DB_PASS pg_dump -h localhost -U $DB_USER $DB_NAME > $BACKUP_FILE
        gzip $BACKUP_FILE
        
        log_info "备份已保存: $BACKUP_FILE.gz"
    fi
    
    # 清理旧备份（保留 30 天）
    find $BACKUP_DIR -name "db_backup_*.gz" -mtime +30 -delete
}

# 恢复数据库
restore() {
    if [ -z "$1" ]; then
        log_error "请提供备份文件路径"
        echo "用法: $0 restore /path/to/backup.db.gz"
        exit 1
    fi
    
    BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    log_warn "即将恢复数据库，这将覆盖现有数据！"
    read -p "确认继续? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "操作已取消"
        exit 0
    fi
    
    log_info "恢复数据库..."
    
    check_env
    source $APP_DIR/.env
    
    # 解压备份
    TEMP_FILE="/tmp/$(basename $BACKUP_FILE .gz)"
    gunzip -c $BACKUP_FILE > $TEMP_FILE
    
    # 恢复 SQLite
    if [[ $DATABASE_URL == *"sqlite"* ]]; then
        cp $TEMP_FILE $DB_PATH
    else
        # 恢复 PostgreSQL
        DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
        DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        
        PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME < $TEMP_FILE
    fi
    
    rm $TEMP_FILE
    
    log_info "数据库恢复完成"
}

# 显示状态
status() {
    log_info "数据库状态检查..."
    
    cd $APP_DIR
    
    npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null || {
        log_error "无法连接到数据库"
        exit 1
    }
    
    log_info "数据库连接正常"
    
    # 显示表信息
    if [[ $DATABASE_URL == *"sqlite"* ]]; then
        log_info "SQLite 数据库文件: $DB_PATH"
        if [ -f $DB_PATH ]; then
            SIZE=$(du -h $DB_PATH | cut -f1)
            log_info "数据库大小: $SIZE"
            log_info "表数量: $(sqlite3 $DB_PATH ".tables" | wc -w)"
        fi
    fi
}

# 帮助信息
show_help() {
    echo "AgentHub 数据库管理脚本"
    echo ""
    echo "用法: $0 <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  dev-init [--seed]     初始化开发数据库（可选：填充种子数据）"
    echo "  prod-migrate          运行生产数据库迁移"
    echo "  backup                备份数据库"
    echo "  restore <文件>         从备份文件恢复数据库"
    echo "  status                显示数据库状态"
    echo "  help                  显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev-init           # 初始化开发数据库"
    echo "  $0 dev-init --seed    # 初始化并填充种子数据"
    echo "  $0 backup             # 备份数据库"
    echo "  $0 restore /path/to/backup.db.gz  # 恢复数据库"
}

# 主程序
case "$1" in
    dev-init)
        dev_init $2
        ;;
    prod-migrate)
        prod_migrate
        ;;
    backup)
        backup
        ;;
    restore)
        restore $2
        ;;
    status)
        status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac
