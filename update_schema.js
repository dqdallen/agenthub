import fs from 'fs';

const filePath = './prisma/schema.prisma';
let content = fs.readFileSync(filePath, 'utf8');

// 更新 Agent 模型
const oldAgentModel = `model Agent {
  id            String    @id @default(cuid())
  agentId       String    @unique // agent 注册时生成的唯一标识
  name          String    // agent 名称
  apiKey        String    @unique // agent 访问 API 的密钥
  status        String    @default("UNBOUND") // UNBOUND-未绑定, BOUND-已绑定, REVOKED-已撤销
  
  userId        Int?      // 绑定后关联的用户ID
  user          User?     @relation(fields: [userId], references: [id])
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  boundAt       DateTime? // 绑定时间
  
  // 统计信息
  tasksCompleted Int      @default(0)
  totalEarnings  Float    @default(0)
}`;

const newAgentModel = `model Agent {
  id            String    @id @default(cuid())
  agentId       String    @unique // agent 注册时生成的唯一标识
  name          String    // agent 名称
  apiKey        String    @unique // agent 访问 API 的密钥
  status        String    @default("UNBOUND") // UNBOUND-未绑定, BOUND-已绑定, REVOKED-已撤销
  
  userId        Int?      // 绑定后关联的用户ID
  user          User?     @relation(fields: [userId], references: [id])
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  boundAt       DateTime? // 绑定时间
  
  // 统计信息
  tasksCompleted Int      @default(0)
  totalEarnings  Float    @default(0)
  
  // 聊天相关
  willingToChat  Boolean   @default(false) // 是否愿意接收聊天请求
  displayName    String?  // 聊天中显示的名称
  
  // 关联的会话
  initiatedSessions AgentChatSession[] @relation("InitiatorAgent")
  receivedSessions  AgentChatSession[] @relation("ReceiverAgent")
  messages         AgentChatMessage[]
}`;

content = content.replace(oldAgentModel, newAgentModel);

// 在 API Key 模型之前添加新的聊天模型
const apiKeyModel = `// ============================================
// API Key 模型（支持 HMAC 签名）`;

const chatModels = `// ============================================
// Agent 聊天会话模型
// ============================================
model AgentChatSession {
  id            Int       @id @default(autoincrement())
  sessionType   String    @default("DIRECT") // TASK-任务相关, DIRECT-直接聊天
  
  // 关联的任务（可选）
  taskId        Int?
  task          Task?     @relation(fields: [taskId], references: [id])
  
  // 参与者
  initiatorAgentId String  // 发起者 Agent ID
  initiatorAgent  Agent   @relation("InitiatorAgent", fields: [initiatorAgentId], references: [agentId])
  
  receiverAgentId   String  // 接收者 Agent ID
  receiverAgent     Agent   @relation("ReceiverAgent", fields: [receiverAgentId], references: [agentId])
  
  status        String    @default("ACTIVE") // ACTIVE-进行中, ENDED-已结束, ARCHIVED-已归档
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  endedAt       DateTime?
  
  messages      AgentChatMessage[]
}

// ============================================
// Agent 聊天消息模型
// ============================================
model AgentChatMessage {
  id            Int       @id @default(autoincrement())
  sessionId     Int
  session       AgentChatSession @relation(fields: [sessionId], references: [id])
  
  senderAgentId String    // 发送者 Agent ID
  senderAgent   Agent     @relation(fields: [senderAgentId], references: [agentId])
  
  content       String    // 消息内容
  
  type          String    @default("TEXT") // TEXT-普通文本, SYSTEM-系统消息
  
  readBy        String    @default("[]") // JSON 数组，已读的 Agent ID 列表
  
  createdAt     DateTime  @default(now())
}

${apiKeyModel}`;

content = content.replace(apiKeyModel, chatModels);

// 更新 User 模型的反向关系
const oldUserRelation = `  // Agent 绑定关系
  agents        Agent[]`;

const newUserRelation = `  // Agent 绑定关系
  agents        Agent[]
  
  // Agent 聊天会话关系
  agentChatSessions AgentChatSession[]`;

content = content.replace(oldUserRelation, newUserRelation);

// 更新 Task 模型添加反向关系
const taskOldRelation = `  // 通知记录
  notifications    Notification[]`;

const taskNewRelation = `  // 通知记录
  notifications    Notification[]
  
  // Agent 聊天会话关系
  agentChatSessions AgentChatSession[]`;

content = content.replace(taskOldRelation, taskNewRelation);

fs.writeFileSync(filePath, content);
console.log('Schema updated successfully!');