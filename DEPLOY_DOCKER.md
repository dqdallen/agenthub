# AgentHub 部署指南 - Docker 篇

## 🚀 Docker 部署（最简单方式）

### 前置条件
- Docker 已安装
- Docker Compose 已安装

### 快速部署

```bash
# 1. 进入项目目录
cd /workspace

# 2. 配置环境变量
cp .env.production .env
nano .env  # 修改 JWT_SECRET 为强密钥

# 3. 构建并启动
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 访问应用
# 浏览器打开: http://your-server-ip:3001
```

### 配置说明

编辑 `.env` 文件：

```bash
# 服务器配置
PORT=3001
NODE_ENV=production

# JWT 密钥（必须修改！）
JWT_SECRET=your-super-secret-key-at-least-32-characters-long

# 数据库（Docker 使用 SQLite）
DATABASE_URL=file:/app/data/prod.db

# CORS 配置
CORS_ORIGIN=http://your-domain.com,https://your-domain.com

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 管理命令

```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f agenthub

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新部署
docker-compose pull
docker-compose up -d

# 进入容器
docker exec -it agenthub-server bash
```

### 数据持久化

Docker 配置已包含数据卷挂载：
- 数据库文件：`./data/prod.db`
- 日志文件：`./logs/`

### 生产环境优化

编辑 `docker-compose.yml` 添加更多配置：

```yaml
services:
  agenthub:
    # ... 其他配置 ...
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:/app/data/prod.db
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://yourdomain.com
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX_REQUESTS=100
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### SSL/HTTPS 配置

使用 Nginx 反向代理：

```bash
# 1. 安装 Nginx
sudo apt install nginx

# 2. 复制 Nginx 配置
sudo cp nginx.agenthub.conf /etc/nginx/sites-available/agenthub

# 3. 修改配置中的域名
sudo nano /etc/nginx/sites-available/agenthub

# 4. 启用配置
sudo ln -sf /etc/nginx/sites-available/agenthub /etc/nginx/sites-enabled/

# 5. 测试并重载
sudo nginx -t
sudo systemctl reload nginx

# 6. 获取 SSL 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 故障排查

```bash
# 查看容器状态
docker ps -a

# 查看实时日志
docker-compose logs --tail=100 -f

# 检查容器内部
docker exec -it agenthub-server /bin/sh

# 重置数据库
docker-compose down
rm -rf data/
docker-compose up -d

# 完全重建
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### 性能监控

```bash
# 查看资源使用
docker stats

# 查看容器详细信息
docker inspect agenthub-server

# 查看日志文件
ls -lh logs/
tail -f logs/production-*.log
```

### 备份策略

```bash
# 备份数据库
cp data/prod.db data/backup_$(date +%Y%m%d).db

# 备份整个数据目录
tar -czf backup_$(date +%Y%m%d).tar.gz data/ logs/

# 自动化备份脚本
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份
tar -czf $BACKUP_DIR/agenthub_$DATE.tar.gz data/ logs/

# 清理旧备份（保留 30 天）
find $BACKUP_DIR -name "agenthub_*.tar.gz" -mtime +30 -delete
```

### Docker 部署检查清单

- [ ] Docker 和 Docker Compose 已安装
- [ ] `.env` 文件已配置（JWT_SECRET 必改）
- [ ] 数据库迁移已运行
- [ ] 防火墙已配置（允许 80/443 端口）
- [ ] 数据目录权限正确
- [ ] 日志目录已创建
- [ ] SSL 证书已配置（生产环境）
- [ ] 备份策略已设置

### 下一步

1. 配置域名 DNS
2. 获取 SSL 证书
3. 配置防火墙
4. 设置监控和告警
5. 配置自动备份
