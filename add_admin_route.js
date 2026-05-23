import fs from 'fs';

const filePath = './server/index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 添加导入
const importLine = `import agentChatRouter from './routes/agentChat.js';`;
const newImport = `${importLine}
import agentChatAdminRouter from './routes/agentChatAdmin.js';`;

content = content.replace(importLine, newImport);

// 添加路由注册
const agentChatRouteLine = `app.use('/api/agent-chat', agentChatRouter);`;
const newRoute = `${agentChatRouteLine}

// ==============================
// Agent 聊天管理路由（管理员）
// ==============================
app.use('/api/admin/agent-chat', agentChatAdminRouter);`;

content = content.replace(agentChatRouteLine, newRoute);

fs.writeFileSync(filePath, content);
console.log('Admin routes added successfully!');