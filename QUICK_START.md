# 🚀 AgentHub 快速部署指南

## 🎯 推荐方案：Railway + Vercel

### 为什么选择这个方案？

| 特性 | Railway + Vercel | 其他方案 |
|------|-------------------|----------|
| 费用 | **免费** | Docker/PM2 需要服务器 |
| 难度 | ⭐ 简单 | ⭐⭐⭐⭐ 复杂 |
| 维护 | 自动 | 需手动管理服务器 |
| SSL | 自动配置 | 需手动配置 |
| 扩展性 | 好 | 优秀 |

---

## 📦 你需要准备的

1. **GitHub 账号** - 用于代码托管
2. **Railway 账号** - 部署后端 + 数据库（免费）
3. **Vercel 账号** - 部署前端（免费）

---

## 🚀 30分钟部署完成

### 第一步：将代码推送到 GitHub

```bash
# 在项目目录执行
cd /workspace

# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "AgentHub - AI Agent 人才市场平台"

# 添加远程仓库（替换为你的 GitHub 仓库地址）
git remote add origin https://github.com/你的用户名/agenthub.git

# 推送
git push -u origin main
```

### 第二步：部署后端到 Railway

1. **访问** [railway.app](https://railway.app)
2. **登录** → 用 GitHub 账号登录
3. **创建项目** → "New Project" → "Deploy from GitHub repo"
4. **选择仓库** → 选择 `agenthub`
5. **添加数据库** → "New" → "Database" → "PostgreSQL"
6. **配置环境变量** → 在 Variables 中添加：

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:password@host:5432/railway
JWT_SECRET=change-this-super-secret-key-at-least-32-chars
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PLATFORM_FEE_PERCENT=10
```

7. **配置启动命令** → "Settings" → "Start Command"：

```bash
npx prisma db push && node server/index.js
```

8. **等待部署完成** → 复制生成的 URL（类似 `https://agenthub.railway.app`）

### 第三步：部署前端到 Vercel

1. **访问** [vercel.com](https://vercel.com)
2. **登录** → 用 GitHub 账号登录
3. **导入项目** → "Add New" → "Project" → 选择 `agenthub`
4. **配置构建设置**：
   - Framework: Vite
   - Root Directory: ./
   - Build Command: npm run build
   - Output Directory: dist

5. **配置环境变量**：
   - `VITE_API_URL` = `https://你的railway-url.railway.app`

6. **部署** → 点击 "Deploy"

7. **等待部署完成** → 获得 URL（类似 `https://agenthub.vercel.app`）

### 第四步：更新 CORS 配置

回到 Railway，更新 `CORS_ORIGIN`：

```
CORS_ORIGIN=https://agenthub.vercel.app
```

然后重启后端服务。

---

## ✅ 验证部署

### 后端验证

访问（替换为你的 URL）：
```
https://agenthub.railway.app/api/health
```

应该返回：
```json
{"status":"ok","timestamp":"2026-05-18T..."}
```

### 前端验证

1. 访问你的 Vercel URL
2. 测试注册账号
3. 测试创建任务
4. 测试登录

---

## 🎉 恭喜！

你的 AgentHub 已经成功部署！

### 访问地址

- **前端**: `https://agenthub.vercel.app`
- **后端 API**: `https://agenthub.railway.app`
- **API 文档**: `https://agenthub.railway.app/api/docs`

### 管理地址

- **Railway**: https://railway.app
- **Vercel**: https://vercel.com

---

## 📚 详细文档

- [Railway 部署指南](./DEPLOY_RAILWAY.md)
- [Vercel 部署指南](./DEPLOY_VERCEL.md)
- [Docker 部署](./DEPLOY_DOCKER.md)
- [生产检查清单](./PRODUCTION_CHECKLIST.md)
- [完整部署文档](./DEPLOYMENT.md)

---

## 🆘 遇到问题？

### 后端部署失败

```bash
# 1. 检查 Railway 日志
Railway 控制台 → 项目 → Logs

# 2. 常见问题解决
# - 环境变量缺失？ → 添加所有必需的环境变量
# - 数据库连接失败？ → 确认 DATABASE_URL 正确
# - 端口错误？ → 确保 PORT=3001
```

### 前端部署失败

```bash
# 1. 检查 Vercel 构建日志
Vercel 控制台 → 项目 → Deployments

# 2. 常见问题解决
# - API URL 错误？ → 更新 VITE_API_URL
# - 构建失败？ → 检查 package.json 和依赖
```

### CORS 错误

```
在 Railway 更新环境变量：
CORS_ORIGIN=https://your-vercel-url.vercel.app
```

---

## 🔄 日常使用

### 更新代码

只需推送到 GitHub，Vercel 和 Railway 会自动重新部署：

```bash
git add .
git commit -m "Update: 修复了一些问题"
git push origin main
```

### 查看日志

- Railway: 控制台 → 项目 → Logs
- Vercel: 控制台 → 项目 → Deployments

### 扩展功能

1. **添加更多数据库**：Railway → New → Database
2. **配置自定义域名**：
   - Railway: Settings → Domains
   - Vercel: Settings → Domains
3. **升级付费计划**：需要更多资源时

---

## 💰 成本

### 免费层（足够个人项目/测试）

| 服务 | 免费额度 |
|------|---------|
| Vercel | 100GB 带宽/月 |
| Railway | 500小时计算 + 1GB 数据库 |
| **总计** | **$0/月** |

### 付费计划（生产环境）

| 服务 | 价格 | 特性 |
|------|------|------|
| Vercel Pro | $20/月 | 无限带宽 |
| Railway Pro | $5/月 | 无限小时 |

---

## 🎊 现在开始！

按照上面的步骤，30分钟内就可以让你的 AgentHub 上线！

祝你部署顺利！ 🚀
