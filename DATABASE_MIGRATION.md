# AgentHub 数据库迁移指南

## 概述

本指南将帮助您从 SQLite 迁移到 PostgreSQL 生产数据库。

## 快速开始

### 1. 前置要求

确保已安装：
- Docker & Docker Compose
- Node.js 18+
- npm 或 yarn

### 2. 一键初始化数据库

```bash
# 执行自动初始化脚本（推荐）
./setup-database.sh
```

如果脚本执行成功，您可以跳转到 [步骤 5](#5-验证安装)。

### 3. 手动初始化步骤

#### 步骤 1: 启动 PostgreSQL

```bash
# 方法 1: 使用 Docker Compose 启动
docker-compose up -d postgres

# 或者启动完整服务（包括 Adminer）
docker-compose up -d
```

#### 步骤 2: 配置环境变量

```bash
# 如果没有 .env 文件，从示例创建
cp .env.example .env

# 确认 DATABASE_URL 配置正确
# .env 文件应该包含：
DATABASE_URL=postgresql://agenthub:agenthub_password@localhost:5432/agenthub?schema=public
```

#### 步骤 3: 运行 Prisma 迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 创建并运行迁移
npx prisma migrate dev --name init

# 或者在生产环境中运行部署迁移
npx prisma migrate deploy
```

#### 步骤 4: 运行数据库种子

```bash
# 运行种子脚本填充测试数据
npx prisma db seed
```

#### 步骤 5: 验证安装

```bash
# 访问 Adminer 管理界面
# 浏览器打开: http://localhost:8080
#
# 登录信息:
#   系统: PostgreSQL
#   服务器: postgres
#   用户名: agenthub
#   密码: agenthub_password
#   数据库: agenthub

# 或者使用 psql 命令行
docker exec -it agenthub-postgres psql -U agenthub -d agenthub
```

## 数据库迁移历史

### 从 SQLite 迁移现有数据（可选）

如果您有现有的 SQLite 数据库需要迁移：

```bash
# 方法 1: 使用 Prisma Studio 导出和导入数据
npx prisma studio

# 方法 2: 使用 pgloader（需要安装 pgloader）
# 创建迁移配置文件
```

## 常用命令

### Docker 相关

```bash
# 查看服务状态
docker-compose ps

# 查看 PostgreSQL 日志
docker-compose logs -f postgres

# 停止数据库服务
docker-compose stop postgres

# 停止并删除容器（保留数据）
docker-compose down

# 停止并删除容器和数据卷（⚠️ 数据会丢失！）
docker-compose down -v

# 重启数据库
docker-compose restart postgres
```

### Prisma 相关

```bash
# 生成 Prisma Client
npx prisma generate

# 打开 Prisma Studio（数据库管理界面）
npx prisma studio

# 创建新迁移
npx prisma migrate dev --name descriptive_name

# 部署迁移到生产环境
npx prisma migrate deploy

# 查看迁移状态
npx prisma migrate status

# 重置数据库（⚠️ 数据会丢失！）
npx prisma migrate reset
```

### 数据库备份与恢复

```bash
# 备份数据库
docker exec agenthub-postgres pg_dump -U agenthub agenthub > backup.sql

# 恢复数据库
docker exec -i agenthub-postgres psql -U agenthub -d agenthub < backup.sql

# 或者使用 pg_dumpall 备份所有数据库
docker exec agenthub-postgres pg_dumpall -U agenthub > full_backup.sql
```

## 生产环境部署

### 使用云数据库

#### Supabase

1. 在 Supabase 创建新项目
2. 获取数据库连接字符串
3. 更新 `.env` 文件：

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

#### AWS RDS

1. 创建 PostgreSQL 数据库实例
2. 更新安全组允许连接
3. 更新 `.env` 文件：

```env
DATABASE_URL="postgresql://[USERNAME]:[PASSWORD]@[ENDPOINT]:5432/[DB-NAME]"
```

#### Railway

1. 在 Railway 创建 PostgreSQL 服务
2. 获取连接字符串
3. 更新 `.env` 文件：

```env
DATABASE_URL="postgresql://[USERNAME]:[PASSWORD]@[HOST]:[PORT]/[DB-NAME]"
```

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 必填 |
| `PORT` | 后端服务端口 | 3001 |
| `NODE_ENV` | 运行环境 | production |
| `JWT_SECRET` | JWT 签名密钥 | 必填 |

## 故障排除

### 问题 1: 数据库连接失败

**错误信息：**
```
Can't reach database server at `localhost:5432`
```

**解决方案：**
```bash
# 检查容器是否运行
docker-compose ps

# 如果没运行，启动容器
docker-compose up -d postgres

# 检查容器日志
docker-compose logs postgres
```

### 问题 2: 迁移失败

**错误信息：**
```
Database schema is not empty
```

**解决方案：**
```bash
# 重置数据库（⚠️ 数据会丢失！）
npx prisma migrate reset

# 或者强制应用迁移
npx prisma db push --accept-data-loss
```

### 问题 3: 端口被占用

**错误信息：**
```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**解决方案：**
```bash
# 找到占用端口的进程
lsof -i :5432

# 修改 docker-compose.yml 使用其他端口
# 将 "5432:5432" 改为 "5433:5432"
```

### 问题 4: Prisma Client 未找到

**错误信息：**
```
Could not find Prisma Client in the expected path
```

**解决方案：**
```bash
# 重新生成 Prisma Client
npx prisma generate
```

## 性能优化建议

### PostgreSQL 配置

对于生产环境，可以考虑优化以下 PostgreSQL 配置：

```yaml
# 在 docker-compose.yml 中添加 command 配置
services:
  postgres:
    # ...
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=16MB
      -c maintenance_work_mem=64MB
```

### Prisma 查询优化

1. 使用关系预加载
2. 添加适当的索引
3. 使用分页查询
4. 避免 N+1 查询问题

## 安全建议

1. **修改默认密码**
   - 在生产环境中修改 `agenthub_password`
   - 更新 `.env` 文件中的密码

2. **限制数据库访问**
   - 配置防火墙规则
   - 使用 VPN 或 VPC
   - 限制 IP 白名单

3. **定期备份**
   - 设置自动备份策略
   - 测试备份恢复流程

4. **SSL 连接**
   - 在生产环境启用 SSL
   - 更新连接字符串：

```env
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

## 下一步

1. 运行应用
   ```bash
   npm run dev
   ```

2. 测试 API
   ```bash
   # 健康检查
   curl http://localhost:3001/api/health
   ```

3. 访问前端
   ```
   http://localhost:5173
   ```

## 获取帮助

如果遇到问题：

1. 查看 [架构文档](./PROJECT_ARCHITECTURE.md)
2. 检查 Docker 和 Prisma 日志
3. 查看 Prisma 官方文档：https://www.prisma.io/docs

---

**文档版本:** 1.0  
**最后更新:** 2026-05-22  
**维护者:** AgentHub Team
