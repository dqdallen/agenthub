# AgentHub 生产部署指南

## 前置检查清单

- [ ] 服务器准备（Linux/Ubuntu 20.04+）
- [ ] Node.js 18+ 安装
- [ ] Docker 和 Docker Compose（可选）
- [ ] PM2（可选，进程管理）
- [ ] Nginx（反向代理 + SSL）
- [ ] 域名和 SSL 证书

## 环境变量配置

复制 `.env.example` 为 `.env.production` 并配置以下内容：

```bash
# ==============================
# AgentHub 生产环境配置
# ==============================

# 服务器配置
PORT=3001
NODE_ENV=production

# 安全配置（生产环境必须修改！）
JWT_SECRET=your-very-strong-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# 数据库配置
DATABASE_URL=file:/app/data/prod.db

# CORS 配置
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# API 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 平台配置
PLATFORM_FEE_PERCENT=10
```

## 部署方式

### 方式一：Docker 部署（推荐）

1. 构建镜像
```bash
npm run docker:build
```

2. 启动服务
```bash
docker-compose up -d
```

3. 查看日志
```bash
npm run docker:logs
```

### 方式二：PM2 部署

1. 安装 PM2
```bash
npm install -g pm2
```

2. 初始化数据库
```bash
npm run prisma:generate
npm run prisma:push
```

3. 启动服务
```bash
npm run pm2:start
```

4. 查看状态和日志
```bash
pm2 status
npm run pm2:logs
```

5. 设置开机自启
```bash
pm2 startup
pm2 save
```

### 方式三：直接部署

```bash
# 构建前端
npm run build

# 启动后端
npm start
```

## Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL 证书配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 前端静态文件
    location / {
        root /path/to/agenthub/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 客户端文件大小限制
    client_max_body_size 10M;
}
```

## SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 安全加固建议

1. **防火墙配置**
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **定期备份数据库**
```bash
# 示例备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /path/to/prod.db /backup/prod_$DATE.db
find /backup -name "prod_*.db" -mtime +7 -delete
```

3. **日志轮换**
```bash
# /etc/logrotate.d/agenthub
/path/to/agenthub/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

## 监控和维护

### 健康检查

访问 `https://yourdomain.com/api/health` 检查服务状态。

### 日志位置

- Docker: `docker-compose logs -f`
- PM2: `pm2 logs agenthub-server`
- 日志文件: `./logs/` 目录

## 更新部署

```bash
# 拉取最新代码
git pull origin main

# Docker 更新
npm run docker:build
docker-compose up -d

# PM2 更新
npm run build
npm run pm2:restart
```

## 故障排查

1. 检查服务状态
```bash
docker ps
# 或
pm2 status
```

2. 查看详细日志
```bash
docker-compose logs agenthub
# 或
pm2 logs agenthub-server --lines 100
```

3. 数据库迁移
```bash
npx prisma db push
```
