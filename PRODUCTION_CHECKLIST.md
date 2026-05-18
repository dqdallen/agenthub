# AgentHub 生产部署检查清单

## 📋 部署前检查清单

### 基础设施
- [ ] 服务器准备（推荐：Ubuntu 20.04+ / 2GB+ RAM / 20GB+ 存储）
- [ ] 域名已注册并配置 DNS 解析
- [ ] SSL 证书准备（Let's Encrypt 或其他）
- [ ] 服务器 SSH 访问配置完成

### 代码准备
- [ ] 代码已推送到 Git 仓库
- [ ] 所有测试通过（运行 `npm test`）
- [ ] 前端构建成功（运行 `npm run build`）
- [ ] 数据库 Schema 已审核

### 配置文件
- [ ] `.env` 文件已创建并配置（参考 `.env.production`）
- [ ] 数据库连接已测试
- [ ] JWT 密钥已生成（强密钥，至少 32 字符）
- [ ] CORS 配置已设置为生产域名

---

## 🚀 部署步骤

### 第一阶段：服务器准备

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装基础软件
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# 3. 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# 4. 安装 PM2
sudo npm install -g pm2

# 5. 配置 PM2 日志轮换
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 第二阶段：部署应用

```bash
# 1. 创建应用目录
sudo mkdir -p /var/www/agenthub
sudo chown $USER:$USER /var/www/agenthub

# 2. 克隆代码
cd /var/www/agenthub
git clone https://github.com/yourusername/agenthub.git .

# 3. 安装依赖
npm ci --production

# 4. 配置环境变量
cp .env.production .env
nano .env  # 编辑配置

# 5. 生成 Prisma Client
npx prisma generate

# 6. 运行数据库迁移
npx prisma db push

# 7. 构建前端
npm run build
```

### 第三阶段：配置 Nginx

```bash
# 1. 复制 Nginx 配置
sudo cp nginx.agenthub.conf /etc/nginx/sites-available/agenthub

# 2. 编辑配置（修改域名）
sudo nano /etc/nginx/sites-available/agenthub

# 3. 创建符号链接
sudo ln -sf /etc/nginx/sites-available/agenthub /etc/nginx/sites-enabled/

# 4. 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 5. 测试配置
sudo nginx -t

# 6. 重载 Nginx
sudo systemctl reload nginx
```

### 第四阶段：配置 SSL

```bash
# 使用 Let's Encrypt 获取免费 SSL 证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --email admin@yourdomain.com --agree-tos --non-interactive

# 自动续期测试
sudo certbot renew --dry-run
```

### 第五阶段：启动服务

```bash
# 1. 启动应用（使用 PM2）
cd /var/www/agenthub
pm2 start ecosystem.config.cjs --env production

# 2. 保存配置
pm2 save

# 3. 设置开机自启
pm2 startup

# 4. 检查状态
pm2 status
pm2 logs agenthub-server
```

### 第六阶段：安全加固

```bash
# 1. 配置防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
echo "y" | sudo ufw enable

# 2. 运行安全加固脚本
sudo bash /var/www/agenthub/scripts/security-hardening.sh

# 3. 配置自动备份
sudo bash /var/www/agenthub/scripts/db-manage.sh backup
```

---

## ✅ 部署后验证清单

### 服务状态
- [ ] 后端服务运行中：`pm2 status`
- [ ] Nginx 运行中：`sudo systemctl status nginx`
- [ ] 数据库连接正常：`curl http://localhost:3001/api/health`
- [ ] SSL 证书有效：访问 https://yourdomain.com

### 功能测试
- [ ] 首页可以访问
- [ ] 用户可以注册
- [ ] 用户可以登录
- [ ] API 文档可访问：https://yourdomain.com/api/docs
- [ ] 健康检查正常：https://yourdomain.com/api/health

### 安全检查
- [ ] 防火墙已启用：`sudo ufw status`
- [ ] Fail2ban 已运行：`sudo systemctl status fail2ban`
- [ ] SSL 证书有效（无过期警告）
- [ ] API 速率限制生效
- [ ] CORS 配置正确

### 监控设置
- [ ] 日志路径配置正确
- [ ] PM2 监控设置
- [ ] 自动备份已配置（crontab）
- [ ] 日志轮换已配置

---

## 🔧 常用运维命令

### 服务管理
```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart agenthub-server

# 查看日志
pm2 logs agenthub-server --lines 100

# 重新加载配置
pm2 reload agenthub-server
```

### Nginx 管理
```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 重启 Nginx
sudo systemctl restart nginx
```

### 数据库管理
```bash
# 备份数据库
bash scripts/db-manage.sh backup

# 查看状态
bash scripts/db-manage.sh status

# 运行迁移
npx prisma migrate deploy
```

### 日志查看
```bash
# Nginx 访问日志
sudo tail -f /var/log/nginx/agenthub_access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/agenthub_error.log

# PM2 日志
pm2 logs agenthub-server

# 应用日志
tail -f /var/www/agenthub/logs/production-*.log
```

---

## 🚨 故障排查

### 服务无法启动
```bash
# 检查端口占用
sudo lsof -i :3001
sudo lsof -i :80
sudo lsof -i :443

# 检查进程状态
ps aux | grep node
ps aux | grep nginx

# 查看详细错误
pm2 logs agenthub-server --err
```

### 数据库连接失败
```bash
# 检查数据库文件
ls -la prisma/*.db

# 测试连接
npx prisma db execute --stdin <<< "SELECT 1"

# 查看数据库状态
bash scripts/db-manage.sh status
```

### SSL 证书问题
```bash
# 检查证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew

# 检查 Nginx SSL 配置
sudo nginx -t -D SSL
```

### 权限问题
```bash
# 修复文件权限
sudo chown -R www-data:www-data /var/www/agenthub
sudo chmod -R 755 /var/www/agenthub

# 修复环境变量文件权限
sudo chmod 600 /var/www/agenthub/.env
```

---

## 📊 性能优化建议

### Nginx 优化
- 启用 Gzip 压缩（已配置）
- 启用浏览器缓存（已配置）
- 考虑使用 CDN 加速静态资源

### 数据库优化
- 监控查询性能
- 定期清理旧数据
- 配置数据库连接池

### 应用优化
- 监控内存使用
- 配置合理的进程数
- 使用 Redis 缓存（可选）

---

## 🔄 更新部署流程

```bash
# 1. 进入目录
cd /var/www/agenthub

# 2. 拉取代码
git pull origin main

# 3. 安装依赖
npm ci

# 4. 运行迁移（如有）
npx prisma migrate deploy

# 5. 重新构建
npm run build

# 6. 重启服务
pm2 restart agenthub-server

# 7. 验证
curl http://localhost:3001/api/health
```

---

## 📞 技术支持

如遇问题，请检查：
1. 日志文件
2. 服务状态
3. 配置文件
4. 网络连接

如无法解决，请提供：
- 错误日志
- 服务状态截图
- 配置文件（脱敏后）
