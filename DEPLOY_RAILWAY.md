# AgentHub Railway 部署指南

## 🎯 为什么选择 Railway？

Railway 是最适合 AgentHub 的部署平台，因为：

- ✅ 支持 Node.js 后端 + 数据库一键部署
- ✅ 自动配置 HTTPS 和域名
- ✅ 免费额度充足（500小时/月）
- ✅ 部署简单，GitHub 集成
- ✅ 支持 PostgreSQL 数据库

---

## 🚀 快速开始

### 第一步：创建 Railway 账号

1. 访问 [railway.app](https://railway.app)
2. 点击 "Login" → "Login with GitHub"
3. 授权 Railway 访问你的 GitHub 仓库

### 第二步：创建新项目

1. Railway 控制台 → "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择 `agenthub` 仓库

### 第三步：配置环境变量

在 Railway 控制台 → 项目 → "Variables" 添加：

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:password@host:5432/railway
JWT_SECRET=your-super-secret-key-at-least-32-characters-change-this
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-project.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PLATFORM_FEE_PERCENT=10
```

### 第四步：配置启动命令

Railway 会自动检测 `package.json`，但需要确保启动命令正确：

1. 项目设置 → "Settings"
2. "Start Command" 设置为：

```bash
npx prisma db push && node server/index.js
```

### 第五步：添加 PostgreSQL 数据库

1. Railway 控制台 → 你的项目
2. 点击 "New" → "Database" → "PostgreSQL"
3. Railway 会自动创建数据库并提供连接 URL

### 第六步：复制数据库连接信息

1. PostgreSQL 服务 → "Connect"
2. 复制 `DATABASE_URL`
3. 粘贴到后端项目的环境变量中

### 第七步：等待部署完成

Railway 会自动：
1. 安装依赖
2. 生成 Prisma Client
3. 运行数据库迁移
4. 启动服务器

部署完成后，你会获得一个 URL，例如：
```
https://agenthub.railway.app
```

---

## 🔧 配置自定义域名

### Railway 域名配置

1. Railway 控制台 → 项目 → "Settings" → "Networking"
2. 点击 "Generate Domain"
3. Railway 会生成一个免费子域名

### 添加自定义域名

1. Railway 控制台 → 项目 → "Settings" → "Domains"
2. 点击 "Add Domain"
3. 输入你的域名
4. 按照提示配置 DNS 记录

DNS 配置示例：
```
类型    名称    值
A       @       34.82.174.100
CNAME   www     your-app.railway.app
```

---

## 📊 管理与监控

### 查看日志

```bash
# 实时日志
Railway 控制台 → 项目 → Logs

# 或通过 CLI
railway logs -p <project-id>
```

### 查看指标

```
Railway 控制台 → 项目 → Metrics
```

包括：
- CPU 使用率
- 内存使用
- 网络流量
- 请求数

### 重启服务

```
Railway 控制台 → 项目 → Actions → Restart
```

---

## 🐛 故障排查

### 部署失败

**常见原因：**
1. 环境变量未配置
2. 启动命令错误
3. 数据库连接失败

**解决方法：**
```bash
# 1. 检查日志
Railway 控制台 → Logs

# 2. 检查环境变量
Railway 控制台 → Variables

# 3. 手动运行数据库迁移
railway run npx prisma db push
```

### 数据库连接失败

**原因：**
1. 数据库未启动
2. 连接 URL 错误
3. 数据库不存在

**解决方法：**
```bash
# 1. 检查数据库状态
Railway 控制台 → 数据库服务

# 2. 验证连接 URL
echo $DATABASE_URL

# 3. 测试连接
railway run psql $DATABASE_URL
```

### 应用无法启动

**原因：**
1. 端口配置错误
2. 依赖安装失败
3. 代码错误

**解决方法：**
```bash
# 1. 检查构建日志
Railway 控制台 → Deployments

# 2. 手动构建测试
railway run npm run build

# 3. 检查 Node 版本
railway run node -v
```

---

## 💰 Railway 成本

### 免费层（足够个人项目）

| 资源 | 限制 | 价格 |
|------|------|------|
| 计算时间 | 500小时/月 | $0 |
| PostgreSQL | 1GB 存储 | $0 |
| 项目数 | 无限 | $0 |
| 带宽 | 100GB/月 | $0 |

### 付费计划

| 计划 | 价格 | 特性 |
|------|------|------|
| Starter | $5/月 | 无限小时，不休眠 |
| Pro | $20/月 | 更多资源，高级支持 |

---

## 🔄 更新部署

### 自动部署（推荐）

只需推送到 GitHub，Railway 会自动重新部署：

```bash
git add .
git commit -m "Update features"
git push origin main
```

### 手动部署

1. Railway 控制台 → 项目
2. 点击 "Deployments"
3. 选择 "Redeploy"

### 回滚到旧版本

1. Railway 控制台 → 项目 → Deployments
2. 选择之前的部署
3. 点击 "Redeploy"

---

## 🛠️ Railway CLI

### 安装

```bash
npm install -g @railway/cli
```

### 登录

```bash
railway login
```

### 常用命令

```bash
# 链接项目
railway init
railway link <project-id>

# 部署
railway up

# 查看日志
railway logs

# 环境变量
railway variables

# 进入 Shell
railway run bash

# 数据库
railway run psql
railway run npx prisma studio
```

---

## 🎯 Railway + Vercel 最佳实践

### 架构

```
用户浏览器
    ↓
Vercel (前端 - 免费)
    ↓
Railway (后端 API + 数据库 - 免费额度)
```

### 部署步骤

1. **Railway 部署后端**
   - 创建 Node.js 项目
   - 添加 PostgreSQL
   - 配置环境变量
   - 获取 API URL

2. **Vercel 部署前端**
   - 导入前端代码
   - 配置 `VITE_API_URL`
   - 部署到 Vercel

3. **配置 CORS**
   - 在 Railway 添加前端域名到 `CORS_ORIGIN`

---

## ✅ 快速检查清单

- [ ] Railway 账号已创建
- [ ] GitHub 仓库已连接
- [ ] 环境变量已配置
- [ ] PostgreSQL 数据库已创建
- [ ] 启动命令正确
- [ ] 部署成功
- [ ] API 健康检查通过
- [ ] 前端已部署（可选）
- [ ] CORS 已配置

---

## 📚 相关资源

- Railway 文档：https://docs.railway.app
- Railway Discord：https://discord.gg/railway
- Prisma Railway 指南：https://docs.railway.app/databases/postgresql

---

## 🎉 成功部署后

你的应用将可以通过以下地址访问：

- **后端 API**: `https://your-app.railway.app`
- **API 文档**: `https://your-app.railway.app/api/docs`
- **健康检查**: `https://your-app.railway.app/api/health`
- **前端**: `https://your-frontend.vercel.app` (可选)

恭喜！AgentHub 已经成功部署到 Railway！🎊
