# AgentHub Railway + Vercel 部署指南

## 📋 概述

本指南将帮助您将 AgentHub 应用部署到 Railway（后端 + 数据库）和 Vercel（前端）。

### 部署架构

```
用户浏览器
    ↓
Vercel CDN（前端静态资源 - 免费）
    ↓
Railway（后端 API + PostgreSQL 数据库）
```

### 免费额度

| 服务 | 免费额度 | 备注 |
|------|---------|------|
| Vercel | 100GB 带宽/月 | 无限项目 |
| Railway | 500小时/月 | $5 续费避免休眠 |
| Railway Postgres | 1GB 存储 | $5 续费 |

---

## 🚀 第一阶段：部署后端到 Railway

### 步骤 1.1：创建 Railway 账号

1. 访问 [railway.app](https://railway.app)
2. 点击 "Login" → "Login with GitHub"
3. 授权 GitHub 访问你的仓库

### 步骤 1.2：创建后端项目

1. Railway 控制台 → "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择 `agenthub` 仓库
4. Railway 会自动检测 Node.js 项目

### 步骤 1.3：添加 PostgreSQL 数据库

1. Railway 控制台 → 你的项目
2. 点击 "New" → "Database" → "PostgreSQL"
3. Railway 会自动创建数据库并提供连接 URL

### 步骤 1.4：配置环境变量

在 Railway 控制台 → 你的项目 → "Variables" 添加：

```bash
# 必须配置
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:password@host:5432/railway
JWT_SECRET=your-super-secret-key-at-least-32-characters-change-this
JWT_EXPIRES_IN=7d

# CORS 配置 - 稍后会在 Vercel 部署后更新
CORS_ORIGIN=https://your-project.vercel.app

# 可选配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PLATFORM_FEE_PERCENT=10
```

**重要提示**：
- `JWT_SECRET` 必须设置为一个强密钥（至少32个字符）
- `DATABASE_URL` 会在创建 PostgreSQL 后自动填充

### 步骤 1.5：配置启动命令

1. 项目设置 → "Settings"
2. "Start Command" 设置为：

```bash
npx prisma db push && node server/index.js
```

这个命令会：
1. 运行数据库迁移（`npx prisma db push`）
2. 启动后端服务（`node server/index.js`）

### 步骤 1.6：获取后端 API URL

部署完成后，Railway 会提供一个新的 URL，例如：
```
https://agenthub.railway.app
```

记下这个 URL，后面会用到。

### 步骤 1.7：测试后端 API

访问健康检查端点：
```
https://your-backend.railway.app/api/health
```

应该返回：
```json
{"status":"ok","timestamp":"2026-05-..."}
```

---

## 🚀 第二阶段：部署前端到 Vercel

### 步骤 2.1：创建 Vercel 账号

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录

### 步骤 2.2：导入项目

1. Vercel 控制台 → "Add New..." → "Project"
2. 导入 `agenthub` 仓库
3. Framework Preset 会自动检测为 "Vite"

### 步骤 2.3：配置构建设置

Vercel 会自动配置，但请确保以下设置正确：

```
Framework Preset: Vite
Root Directory: ./
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 步骤 2.4：配置环境变量

在 Vercel 项目设置 → "Environment Variables" 中添加：

```bash
Key: VITE_API_URL
Value: https://your-backend.railway.app
（替换为您在步骤 1.6 获取的 URL）
```

**重要**：
- 环境变量名必须以 `VITE_` 开头
- 部署后不要修改环境变量值，否则需要重新部署

### 步骤 2.5：部署

1. 点击 "Deploy"
2. Vercel 会自动：
   - 安装依赖
   - 构建前端应用
   - 部署到全球 CDN

部署完成后，你会获得一个 Vercel URL，例如：
```
https://agenthub.vercel.app
```

---

## 🔧 第三阶段：配置 CORS

部署前端后，需要更新后端的 CORS 配置。

### 更新 Railway 环境变量

在 Railway 控制台 → 你的项目 → "Variables" 中修改：

```bash
CORS_ORIGIN=https://your-project.vercel.app,https://your-custom-domain.com
```

多个域名用逗号分隔。

### 重启后端服务

修改环境变量后，需要重启服务：
1. Railway 控制台 → 你的项目
2. 点击 "Actions" → "Restart"

---

## ✅ 验证部署

### 后端验证

```bash
# 健康检查
curl https://your-backend.railway.app/api/health

# API 文档
curl https://your-backend.railway.app/api/docs
```

### 前端验证

1. 访问 `https://your-project.vercel.app`
2. 测试用户注册和登录
3. 测试创建任务
4. 测试 API 调用

### 检查事项

- [ ] 后端健康检查通过
- [ ] 前端页面加载正常
- [ ] 用户注册/登录功能正常
- [ ] API 请求成功（无 CORS 错误）
- [ ] 任务创建/查看功能正常

---

## 📊 更新部署

### 自动部署（推荐）

只需推送到 GitHub，Vercel 和 Railway 都会自动重新部署：

```bash
git add .
git commit -m "Update features"
git push origin main
```

### 手动部署

**Vercel**：
- 控制台点击 "Deployments" → "Redeploy"

**Railway**：
- 控制台点击 "Actions" → "Restart"

### 回滚

**Vercel**：
- Deployments → 选择之前的版本 → "Deploy"

**Railway**：
- Deployments → 选择之前的版本 → "Redeploy"

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
// 在浏览器控制台检查
console.log(import.meta.env.VITE_API_URL)

// 应该显示你的 Railway URL
```

### 数据库连接失败

```bash
# Railway Postgres 冷启动需要 1-2 分钟
# 检查连接字符串是否正确
# 确认数据库迁移已运行
```

### CORS 错误

```javascript
// 检查浏览器控制台错误信息
// 确保 Railway 的 CORS_ORIGIN 包含你的 Vercel URL
// 确保重启了 Railway 服务
```

---

## 💰 成本优化

### 免费层（月）

| 服务 | 用量 | 成本 |
|------|------|------|
| Vercel | 100GB 带宽 | $0 |
| Railway | ~400 小时 | $0 |
| Railway Postgres | 1GB | $0 |
| **总计** | | **$0** |

### 付费优化（推荐个人项目）

| 服务 | 费用 | 优势 |
|------|------|------|
| Railway Pro | $5/月 | 无限小时，永不休眠 |
| Railway Postgres | $5/月 | 10GB 存储 |

**注意**：Railway 免费版会在 500 小时/月后休眠，可能会有冷启动延迟。

---

## 🎯 自定义域名（可选）

### Vercel 域名

1. Vercel 控制台 → 项目 → "Settings" → "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

### Railway 域名（需要付费）

1. Railway 控制台 → 项目 → "Settings" → "Domains"
2. 添加自定义域名

### DNS 配置示例

```
类型    名称    值
A       @       76.76.21.21 (Vercel)
CNAME   www     cname.vercel-dns.com
```

---

## 🔒 安全检查清单

部署前请确认：

- [ ] `JWT_SECRET` 已设置为一个强密钥
- [ ] `NODE_ENV=production` 已设置
- [ ] `CORS_ORIGIN` 只包含信任的域名
- [ ] 数据库密码已更改
- [ ] HTTPS 已启用（默认）

---

## 📞 快速参考

| 资源 | 地址 |
|------|------|
| Vercel | https://vercel.com |
| Railway | https://railway.app |
| Railway 文档 | https://docs.railway.app |
| Vercel 文档 | https://vercel.com/docs |

---

## ✅ 部署检查清单

- [ ] Railway 账号已创建
- [ ] PostgreSQL 数据库已创建
- [ ] 后端环境变量已配置
- [ ] 后端 API 已部署并测试通过
- [ ] Vercel 账号已创建
- [ ] 前端环境变量 `VITE_API_URL` 已配置
- [ ] 前端已部署并测试通过
- [ ] CORS 已正确配置
- [ ] 自定义域名已配置（可选）
- [ ] HTTPS 已启用

---

## 🎉 成功！

恭喜！你的 AgentHub 应用现在已经部署到云端：

- **后端 API**: `https://your-backend.railway.app`
- **API 文档**: `https://your-backend.railway.app/api/docs`
- **前端**: `https://your-project.vercel.app`

应用可以通过互联网访问了！🎊

---

## 🔄 后续维护

### 定期任务

1. **监控**：检查 Railway 和 Vercel 的使用量
2. **备份**：Railway Postgres 自动备份
3. **更新**：保持依赖包最新
4. **日志**：定期检查错误日志

### 扩展建议

当项目增长时：

1. **数据库**：升级到更大的 Railway Postgres 计划
2. **后端**：使用 Railway Pro 避免休眠
3. **CDN**：Vercel Pro 提供更多带宽
4. **监控**：集成 Sentry 或类似服务
