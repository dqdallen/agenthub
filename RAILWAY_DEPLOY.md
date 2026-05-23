# Railway 部署指南

## 🚀 快速部署步骤

### 1. 环境变量配置

在 Railway 控制台 → 项目 → Variables 添加以下变量：

```env
# 基础配置
NODE_ENV=production
PORT=3001

# 数据库（PostgreSQL 连接字符串）
DATABASE_URL=postgresql://postgres:密码@主机:5432/railway

# 安全配置（必须设置！）
JWT_SECRET=你的强密钥
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=https://your-project.vercel.app

# 其他配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PLATFORM_FEE_PERCENT=10
FRONTEND_URL=https://your-project.vercel.app
```

### 2. 启动命令配置

在 Railway 控制台 → 项目 → Settings → Start Command 设置为：

```bash
npx prisma generate && npx prisma db push && node server/index.js
```

**或者更完整的版本**（包含构建）：
```bash
npm install && npx prisma generate && npx prisma db push && npm run start
```

### 3. 部署流程

Railway 会自动执行以下步骤：

1. **安装依赖**：`npm install`
2. **生成 Prisma Client**：`npx prisma generate`
3. **推送数据库 Schema**：`npx prisma db push`
4. **启动服务器**：`node server/index.js`

---

## 🐛 常见问题

### 问题 1：Prisma Schema Engine 错误

**症状**：
```
Error: Could not parse schema engine response
```

**解决方案**：
确保启动命令中包含 `npx prisma generate`

### 问题 2：数据库连接失败

**症状**：
```
Error: P1001: Can't reach database server
```

**解决方案**：
1. 检查 DATABASE_URL 是否正确
2. 确认 PostgreSQL 数据库已启动
3. 检查 Railway 日志中的具体错误

### 问题 3：OpenSSL 警告

**症状**：
```
prisma:warn Prisma failed to detect the libssl/openssl version to use
```

**解决方案**：
可以忽略这个警告，不影响功能。如果想消除警告，可以在 Railway 中安装 OpenSSL。

---

## ✅ 验证部署

部署成功后，访问：

```
https://your-app.railway.app/api/health
```

应该返回：
```json
{"status":"ok","timestamp":"2026-05-..."}
```

---

## 📊 部署状态检查

查看 Railway 控制台 → Deployments 页面，确认：
- [ ] 构建成功（绿色勾号）
- [ ] 健康检查通过
- [ ] 日志无错误

---

## 🔄 更新部署

推送到 GitHub 后，Railway 会自动重新部署。

手动重启：
Railway 控制台 → 项目 → Actions → Restart
