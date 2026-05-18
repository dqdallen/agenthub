#!/bin/bash

# ===========================================
# AgentHub 一键部署脚本
# ===========================================
# 功能：自动完成生产环境部署的所有步骤
# 适用系统：Ubuntu 20.04+ / Debian 11+
# ===========================================

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
APP_DIR="/var/www/agenthub"
APP_USER="agenthub"
APP_GROUP="agenthub"
REPO_URL="https://github.com/yourusername/agenthub.git"  # 修改为你的仓库地址

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误：此脚本需要 root 权限运行${NC}"
    echo "请使用: sudo $0"
    exit 1
fi

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  AgentHub 生产环境一键部署${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# -----------------------------------------
# 函数定义
# -----------------------------------------
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# -----------------------------------------
# 1. 系统准备
# -----------------------------------------
log_info "1. 系统准备..."

# 更新系统
apt update && apt upgrade -y

# 安装必要软件
apt install -y \
    curl \
    wget \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg

log_info "系统准备完成"

# -----------------------------------------
# 2. 安装 Node.js 18+
# -----------------------------------------
log_info "2. 安装 Node.js..."

# 使用 NodeSource 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证安装
node_version=$(node -v)
npm_version=$(npm -v)
log_info "Node.js $node_version 和 npm $npm_version 已安装"

# -----------------------------------------
# 3. 安装 PM2
# -----------------------------------------
log_info "3. 安装 PM2..."

npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

log_info "PM2 已安装并配置"

# -----------------------------------------
# 4. 创建应用用户
# -----------------------------------------
log_info "4. 创建应用用户..."

# 创建用户（如果不存在）
if ! id -u $APP_USER &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    log_info "用户 $APP_USER 已创建"
else
    log_warn "用户 $APP_USER 已存在，跳过创建"
fi

# 创建目录结构
mkdir -p $APP_DIR
mkdir -p /var/www/agenthub/dist
mkdir -p /var/www/agenthub/logs
mkdir -p /var/www/agenthub/data
mkdir -p /var/backups/agenthub

# 设置权限
chown -R $APP_USER:$APP_GROUP $APP_DIR

log_info "目录结构已创建"

# -----------------------------------------
# 5. 部署应用代码
# -----------------------------------------
log_info "5. 部署应用代码..."

cd $APP_DIR

# 如果是 Git 部署
if [ -d ".git" ]; then
    log_info "拉取最新代码..."
    sudo -u $APP_USER git pull origin main
else
    log_warn "不是 Git 仓库，请手动部署代码到 $APP_DIR"
fi

# 安装依赖
log_info "安装依赖..."
sudo -u $APP_USER npm ci --production

# 生成 Prisma Client
log_info "生成 Prisma Client..."
sudo -u $APP_USER npx prisma generate

# 构建前端
log_info "构建前端..."
sudo -u $APP_USER npm run build

# 设置权限
chown -R $APP_USER:$APP_GROUP $APP_DIR/dist

log_info "应用代码部署完成"

# -----------------------------------------
# 6. 配置环境变量
# -----------------------------------------
log_info "6. 配置环境变量..."

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_warn ".env 文件不存在，创建模板..."
    sudo -u $APP_USER cp $APP_DIR/.env.production $ENV_FILE
    log_warn "请编辑 $ENV_FILE 设置正确的值！"
else
    log_info "使用现有的 .env 文件"
fi

chown $APP_USER:$APP_GROUP $ENV_FILE
chmod 600 $ENV_FILE

# -----------------------------------------
# 7. 配置 Nginx
# -----------------------------------------
log_info "7. 配置 Nginx..."

# 复制 Nginx 配置
cp $APP_DIR/nginx.agenthub.conf /etc/nginx/sites-available/agenthub

# 创建符号链接
ln -sf /etc/nginx/sites-available/agenthub /etc/nginx/sites-enabled/agenthub

# 删除默认配置（如果有）
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t

# 重载 Nginx
systemctl reload nginx

log_info "Nginx 配置完成"

# -----------------------------------------
# 8. 配置 SSL 证书
# -----------------------------------------
log_info "8. 配置 SSL 证书..."

# 这里需要你修改为实际的域名
DOMAIN="yourdomain.com"
EMAIL="admin@yourdomain.com"

# 检查是否已有证书
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_warn "SSL 证书未配置，请运行以下命令："
    echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive"
else
    log_info "SSL 证书已存在"
fi

# -----------------------------------------
# 9. 启动应用
# -----------------------------------------
log_info "9. 启动应用..."

# 使用 PM2 启动
cd $APP_DIR
sudo -u $APP_USER pm2 start ecosystem.config.cjs --env production

# 保存 PM2 配置
sudo -u $APP_USER pm2 save

# 设置开机自启
sudo -u $APP_USER pm2 startup

log_info "应用已启动"

# -----------------------------------------
# 10. 配置防火墙
# -----------------------------------------
log_info "10. 配置防火墙..."

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https

echo "y" | ufw enable

log_info "防火墙配置完成"

# -----------------------------------------
# 完成
# -----------------------------------------
echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
echo "访问地址："
echo "  - 网站: https://yourdomain.com"
echo "  - API: https://yourdomain.com/api"
echo "  - 健康检查: https://yourdomain.com/api/health"
echo ""
echo "管理命令："
echo "  - 查看日志: pm2 logs agenthub-server"
echo "  - 重启服务: pm2 restart agenthub-server"
echo "  - 查看状态: pm2 status"
echo ""
echo -e "${YELLOW}后续步骤：${NC}"
echo "1. 修改 .env 文件配置数据库和 JWT 密钥"
echo "2. 配置 SSL 证书: sudo certbot --nginx -d yourdomain.com"
echo "3. 运行数据库迁移: npx prisma db push"
echo "4. 检查防火墙状态: ufw status"
echo ""
