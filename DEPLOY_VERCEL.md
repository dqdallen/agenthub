# AgentHub Vercel + Railway 完整部署指南

## 📋 概述

本指南将帮助你把 AgentHub 应用部署到云端，使其可以通过互联网访问。

### 部署架构

```
用户浏览器
    ↓
Vercel CDN（前端静态资源）
    ↓
后端 API (Railway Node.js)
    ↓
PostgreSQL 数据库 (Railway)
```

### 免费额度

| 服务 | 免费额度 | 备注 |
|------|---------|------|
| Vercel | 100GB 带宽/月 | 无限项目 |
| Railway | 500小时/月 | $5 续费 |
| Railway Postgres | 1GB 存储 | $5 续费 |

---

## 🚀 第一阶段：部署后端 API

### 步骤 1.1：创建 Railway 账号

1. 访问 [railway.app](https://railway.app)
2. 点击 "Login" → "Login with GitHub"
3. 授权 GitHub 访问

### 步骤 1.2：创建后端项目

1. Railway 控制台 → "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择 `agenthub` 仓库
4. 选择 `server` 目录作为根目录（或者创建一个独立的 server 子项目）

#### 💡 更好的方案：分离前后端

为了更好的管理和部署，建议创建两个独立仓库：

```
agenthub-frontend (Vercel)
agenthub-backend (Railway)
```

或者在 monorepo 中配置：

```bash
# 目录结构
agenthub/
├── frontend/     # Vercel
├── backend/     # Railway
└── database/    # 共享
```

### 步骤 1.3：配置环境变量

在 Railway 控制台 → 你的项目 → "Variables" 添加：

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/agenthub
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIIRES_IN=7d
CORS_ORIGIN=https://your-project.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PLATFORM_FEE_PERCENT=10
```

### 步骤 1.4：部署数据库

1. Railway 控制台 → "New Project"
2. 选择 "Provision PostgreSQL"
3. Railway 会自动创建数据库并提供连接 URL

#### 获取数据库连接信息

1. 点击 PostgreSQL 服务
2. 点击 "Connect" 标签
3. 复制 `DATABASE_URL`

### 步骤 1.5：运行数据库迁移

1. Railway 控制台 → 你的后端项目
2. 点击 "Settings" → "Start Command"
3. 修改为：

```bash
npx prisma db push && node server/index.js
```

或者在代码中添加启动脚本。

### 步骤 1.6：测试后端 API

部署完成后，访问：
```
https://your-backend.railway.app/api/health
```

应该返回：
```json
{"status":"ok","timestamp":"2026-05-18T..."}
```

---

## 🚀 第二阶段：部署前端到 Vercel

### 步骤 2.1：创建 Vercel 账号

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录

### 步骤 2.2：导入项目

1. Vercel 控制台 → "Add New..." → "Project"
2. 导入 `agenthub` 仓库
3. 配置构建设置：

```
Framework Preset: Vite
Root Directory: ./
Build Command: npm run build
Output Directory: dist
```

### 步骤 2.3：配置环境变量

在 Vercel 项目设置中添加：

```
Key: VITE_API_URL
Value: https://your-backend.railway.app

Key: VITE_VERCEL_URL
Value: https://your-project.vercel.app (部署后自动填充)
```

### 步骤 2.4：配置域名（可选）

1. Vercel 控制台 → 项目 → "Settings" → "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

### 步骤 2.5：部署

点击 "Deploy"，Vercel 会自动：
1. 安装依赖
2. 构建前端
3. 部署到全球 CDN

---

## ✅ 验证部署

### 后端验证

```bash
# 健康检查
curl https://your-backend.railway.app/api/health

# OpenAPI 文档
curl https://your-backend.railway.app/api/openapi.json
```

### 前端验证

1. 访问 `https://your-frontend.vercel.app`
2. 测试用户注册
3. 测试创建任务
4. 测试 API 调用

---

## 🔧 配置 CORS

部署后需要更新后端的 CORS 配置：

Railway 环境变量：
```bash
CORS_ORIGIN=https://your-frontend.vercel.app,https://your-custom-domain.com
```

然后重启后端服务。

---

## 📊 监控和维护

### Railway 监控

1. 查看日志：`Railway 控制台 → 项目 → Logs`
2. 查看指标：`Railway 控制台 → 项目 → Metrics`
3. 冷启动优化：Railway 会在空闲后休眠，可以升级到 $5/月 避免休眠

### Vercel 监控

1. 查看构建日志
2. 查看性能指标
3. 配置告警

---

## 🔄 更新部署

### 自动部署

只要推送到 GitHub，Vercel 和 Railway 都会自动重新部署。

```bash
git add .
git commit -m "Update code"
git push origin main
```

### 手动部署

- Vercel：控制台点击 "Redeploy"
- Railway：控制台点击 "Redeploy"

---

## 💰 成本估算

### 免费层（月）

| 服务 | 用量 | 成本 |
|------|------|------|
| Vercel | 100GB 带宽 | $0 |
| Railway | ~400 小时 | $0 |
| Railway Postgres | 1GB | $0 |
| **总计** | | **$0** |

### 付费层（月）

| 服务 | 规格 | 成本 |
|------|------|------|
| Vercel Pro | 无限带宽 | $20/月 |
| Railway Pro | 无限小时 | $5/月 |
| Railway Postgres | 10GB | $10/月 |
| **总计** | | **$35/月** |

---

## 🐛 故障排查

### 后端无法启动

```bash
# 检查日志
Railway 控制台 → 项目 → Logs

# 常见问题
1. DATABASE_URL 未配置
2. JWT_SECRET 未设置
3. 端口配置错误
```

### 前端 API 调用失败

```javascript
// 检查 API URL 配置
console.log(import.meta.env.VITE_API_URL)

// 检查 CORS
后端日志中查看 CORS 错误
```

### 数据库连接失败

```bash
# Railway Postgres 冷启动可能需要 1-2 分钟
# 检查连接字符串是否正确
# 确认数据库迁移已运行
```

---

## 🎯 下一步

部署完成后，你可以：

1. **配置自定义域名**
   - Vercel: 添加自定义域名
   - Railway: 配置自定义域名（需要付费）

2. **启用 HTTPS**
   - Vercel: 自动启用
   - Railway: 自动启用

3. **设置监控和告警**
   - 使用 Sentry 监控错误
   - 配置 uptime monitoring

4. **配置自动备份**
   - Railway Postgres 自动备份
   - 设置数据导出任务

---

## 📞 快速参考

| 资源 | 地址 |
|------|------|
| Vercel | https://vercel.com |
| Railway | https://railway.app |
| 文档 | 见项目 README |

---

## ✅ 部署检查清单

- [ ] Railway 账号已创建
- [ ] PostgreSQL 数据库已创建
- [ ] 后端环境变量已配置
- [ ] 后端 API 已部署并测试通过
- [ ] Vercel 账号已创建
- [ ] 前端环境变量已配置
- [ ] 前端已部署并测试通过
- [ ] CORS 已正确配置
- [ ] 自定义域名已配置（可选）
- [ ] HTTPS 已启用

---

恭喜！你的 AgentHub 应用现在已经部署到云端，可以通过互联网访问了！🎉
