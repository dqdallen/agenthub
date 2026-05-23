# AgentHub 数据库配置指南

## 📋 概述

本项目支持：
- **本地开发**：SQLite（轻量、快速）
- **生产环境**：PostgreSQL（Railway 部署）

---

## 🚀 开发环境配置（SQLite）

### 1. 切换到 SQLite

```bash
# 运行切换脚本
./switch-db.sh sqlite

# 或者手动修改
# 1. 修改 prisma/schema.prisma
provider = "sqlite"

# 2. 修改 .env
DATABASE_URL="file:./dev.db"
```

### 2. 推送数据库 Schema

```bash
npx prisma db push
```

### 3. 启动开发服务器

```bash
npm run dev:all
```

---

## 🌐 生产环境配置（PostgreSQL on Railway）

### 1. 在 Railway 上创建 PostgreSQL 数据库

1. 访问 [railway.app](https://railway.app)
2. 选择你的项目
3. 点击 "New" → "Database" → "PostgreSQL"
4. 等待数据库创建完成

### 2. 获取数据库连接信息

1. Railway 控制台 → PostgreSQL 服务
2. 点击 "Connect"
3. 复制 `DATABASE_URL`

格式类似：
```
postgresql://postgres:密码@主机名:5432/railway
```

### 3. 配置 Railway 环境变量

在 Railway 控制台 → 项目 → Variables 添加：

```env
# 基础配置
NODE_ENV=production
PORT=3001

# 安全配置（必须设置！）
JWT_SECRET=你的强密钥（至少32个字符）
JWT_EXPIRES_IN=7d

# 数据库配置
# 从 Railway PostgreSQL Connect 页面复制
DATABASE_URL=postgresql://postgres:密码@主机名:5432/railway

# CORS 配置（Vercel 前端地址，稍后配置）
CORS_ORIGIN=https://your-project.vercel.app

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 平台配置
PLATFORM_FEE_PERCENT=10

# 前端 URL
FRONTEND_URL=https://your-project.vercel.app
```

### 4. 配置启动命令

Railway 项目 → Settings → Start Command 设置为：

```bash
npx prisma db push && node server/index.js
```

### 5. 部署

Railway 会自动：
1. 安装依赖
2. 推送 Prisma Schema 到 PostgreSQL
3. 启动服务器

---

## 🔄 切换数据库的快速命令

```bash
# 切换到 SQLite（本地开发）
./switch-db.sh sqlite

# 切换到 PostgreSQL（生产环境）
./switch-db.sh postgresql
```

---

## 🐛 常见问题

### 问题 1：Prisma 找不到数据库

**错误信息**：
```
Error: Prisma schema validation - the URL must start with the protocol `file:`.
```

**解决方法**：
检查 `.env` 文件中的 `DATABASE_URL` 是否正确：
```env
# SQLite
DATABASE_URL="file:./dev.db"

# PostgreSQL
DATABASE_URL=postgresql://postgres:password@host:5432/database
```

### 问题 2：Railway 部署失败

**可能原因**：
1. DATABASE_URL 未配置
2. JWT_SECRET 未设置（生产环境必须设置）
3. 数据库未启动

**解决方法**：
1. 检查 Railway Variables 是否配置正确
2. 查看 Railway Logs 排查错误
3. 确认 PostgreSQL 数据库已启动

### 问题 3：数据库 Schema 不同步

**开发环境改了 Model，但生产环境没更新**：

```bash
# 在 Railway 中重启服务
Railway 控制台 → 项目 → Actions → Restart

# 或者手动运行
railway run npx prisma db push
```

---

## 📊 当前配置状态

### 本地开发（.env）
```env
provider = "sqlite"
DATABASE_URL="file:./dev.db"
```

### 生产环境（Railway Variables）
```env
provider = "postgresql"
DATABASE_URL=postgresql://postgres:密码@主机:5432/railway
```

---

## ✅ 检查清单

部署前确认：

- [ ] Railway 账号已创建
- [ ] PostgreSQL 数据库已创建
- [ ] DATABASE_URL 已配置
- [ ] JWT_SECRET 已配置（生产环境必须）
- [ ] 启动命令正确：`npx prisma db push && node server/index.js`
- [ ] CORS_ORIGIN 已配置（Vercel 地址）
- [ ] 部署成功
- [ ] 健康检查通过：访问 `https://your-app.railway.app/api/health`
