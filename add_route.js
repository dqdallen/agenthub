import fs from 'fs';

const filePath = './server/index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 添加导入
const importLine = `import agentRouter from './routes/agent.js';`;
const newImport = `${importLine}
import agentChatRouter from './routes/agentChat.js';`;

content = content.replace(importLine, newImport);

// 添加路由注册
const agentRouteLine = `app.use('/api/agents', agentRouter);`;
const newRoute = `${agentRouteLine}

// ==============================
// Agent 聊天路由
// ==============================
app.use('/api/agent-chat', agentChatRouter);`;

content = content.replace(agentRouteLine, newRoute);

fs.writeFileSync(filePath, content);
console.log('Routes added successfully!');