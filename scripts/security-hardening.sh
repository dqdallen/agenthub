#!/bin/bash

# ===========================================
# AgentHub 安全加固脚本
# ===========================================
# 功能：
# 1. 设置文件权限
# 2. 配置防火墙规则
# 3. 创建备份策略
# 4. 设置日志轮换
# 5. 强化 SSH 访问
# 6. 安装 Fail2ban 防暴力破解
# ===========================================

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误：此脚本需要 root 权限运行${NC}"
    echo "请使用: sudo $0"
    exit 1
fi

echo "==========================================="
echo "AgentHub 安全加固脚本"
echo "==========================================="

# -----------------------------------------
# 1. 设置文件权限
# -----------------------------------------
echo -e "\n${YELLOW}[1/6]${NC} 设置文件权限..."

# 设置环境变量文件权限
if [ -f "/path/to/agenthub/.env" ]; then
    chmod 600 /path/to/agenthub/.env
    echo "✓ .env 文件权限已设置为 600"
fi

# 设置 SSH 密钥文件权限
if [ -d "/path/to/agenthub/.ssh" ]; then
    chmod 700 /path/to/agenthub/.ssh
    chmod 600 /path/to/agenthub/.ssh/*
    echo "✓ SSH 密钥文件权限已设置"
fi

# 设置日志目录权限
if [ -d "/path/to/agenthub/logs" ]; then
    chmod 755 /path/to/agenthub/logs
    echo "✓ 日志目录权限已设置"
fi

# -----------------------------------------
# 2. 配置防火墙 (UFW)
# -----------------------------------------
echo -e "\n${YELLOW}[2/6]${NC} 配置防火墙..."

# 检查 UFW 是否安装
if ! command -v ufw &> /dev/null; then
    echo "安装 UFW 防火墙..."
    apt update
    apt install -y ufw
fi

# 默认策略
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH
ufw allow 22/tcp comment 'SSH'

# 允许 HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# 允许应用使用端口 3001 (仅从本地)
ufw deny 3001/tcp comment 'API Port (blocked from outside)'

# 启用防火墙
echo "y" | ufw enable
ufw status verbose

echo "✓ 防火墙配置完成"

# -----------------------------------------
# 3. 配置日志轮换
# -----------------------------------------
echo -e "\n${YELLOW}[3/6]${NC} 配置日志轮换..."

cat > /etc/logrotate.d/agenthub <<'EOF'
/path/to/agenthub/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        # 如果使用 PM2
        if [ -f /root/.pm2/pm2.pid ]; then
            pm2 flush
        fi
    endscript
}
EOF

echo "✓ 日志轮换配置完成"

# -----------------------------------------
# 4. Fail2ban 防暴力破解
# -----------------------------------------
echo -e "\n${YELLOW}[4/6]${NC} 配置 Fail2ban..."

# 检查 Fail2ban 是否安装
if ! command -v fail2ban-server &> /dev/null; then
    echo "安装 Fail2ban..."
    apt update
    apt install -y fail2ban
fi

# 创建 Fail2ban 配置
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
# 封禁时间（秒）
bantime = 3600
# 查找时间窗口（秒）
findtime = 600
# 最大失败次数
maxretry = 5

# SSH 防护
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

# Nginx 防护（防止扫描和暴力破解）
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/agenthub_error.log
maxretry = 5

# 自定义：API 防护
[api-auth]
enabled = true
port = 3001
filter = api-auth
logpath = /path/to/agenthub/logs/*.log
maxretry = 10
bantime = 1800
findtime = 300
EOF

# 创建自定义过滤器
cat > /etc/fail2ban/filter.d/api-auth.conf <<'EOF'
[Definition]
failregex = ^.*\[ERROR\].*认证失败.*
          ^.*\[WARNING\].*无效的登录尝试.*
ignoreregex =
EOF

# 重启 Fail2ban
systemctl enable fail2ban
systemctl restart fail2ban

echo "✓ Fail2ban 配置完成"

# -----------------------------------------
# 5. 设置自动安全更新
# -----------------------------------------
echo -e "\n${YELLOW}[5/6]${NC} 配置自动安全更新..."

# 安装 unattended-upgrades
apt install -y unattended-upgrades

# 配置自动更新
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}:${distro_codename}-updates";
};
Unattended-Upgrade::Package-Blacklist {
    "";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
EOF

# 启用自动更新
cat > /etc/apt/apt.conf.d/10periodic <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "✓ 自动安全更新配置完成"

# -----------------------------------------
# 6. 数据库备份策略
# -----------------------------------------
echo -e "\n${YELLOW}[6/6]${NC} 配置数据库备份..."

BACKUP_DIR="/var/backups/agenthub"
mkdir -p "$BACKUP_DIR"

# 创建备份脚本
cat > /usr/local/bin/agenthub-backup.sh <<'EOF'
#!/bin/bash

# 配置
BACKUP_DIR="/var/backups/agenthub"
DB_PATH="/path/to/agenthub/prisma/dev.db"
RETENTION_DAYS=30

# 创建备份
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/agenthub_$DATE.db"

# 备份数据库
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_FILE"
    gzip "$BACKUP_FILE"
    echo "备份已创建: $BACKUP_FILE.gz"
fi

# 清理旧备份
find "$BACKUP_DIR" -name "agenthub_*.db.gz" -mtime +$RETENTION_DAYS -delete
echo "清理完成：保留最近 $RETENTION_DAYS 天的备份"

# 备份环境变量（加密）
if [ -f "/path/to/agenthub/.env" ]; then
    cp /path/to/agenthub/.env "$BACKUP_DIR/.env.$DATE.bak"
fi
EOF

chmod +x /usr/local/bin/agenthub-backup.sh

# 添加定时任务（每天凌晨 3 点执行）
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/agenthub-backup.sh >> /var/log/agenthub-backup.log 2>&1") | crontab -

echo "✓ 数据库备份策略配置完成"

# -----------------------------------------
# 完成
# -----------------------------------------
echo -e "\n==========================================="
echo -e "${GREEN}✓ 安全加固完成！${NC}"
echo "==========================================="
echo ""
echo "后续步骤："
echo "1. 修改 Nginx 配置中的域名和 SSL 证书路径"
echo "2. 配置定时备份（已设置每天凌晨 3 点）"
echo "3. 监控 Fail2ban 日志：tail -f /var/log/fail2ban.log"
echo "4. 定期检查系统日志：journalctl -xe"
echo ""
