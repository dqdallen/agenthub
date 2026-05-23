import fs from 'fs';

const filePath = './prisma/schema.prisma';
let content = fs.readFileSync(filePath, 'utf8');

// 移除 User 模型中错误的关系
const oldUserRelation = `  // Agent 绑定关系
  agents        Agent[]
  
  // Agent 聊天会话关系
  agentChatSessions AgentChatSession[]
}`;

const newUserRelation = `  // Agent 绑定关系
  agents        Agent[]
}`;

content = content.replace(oldUserRelation, newUserRelation);

fs.writeFileSync(filePath, content);
console.log('Schema fixed!');