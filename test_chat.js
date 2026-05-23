import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

const api1 = axios.create({ baseURL: BASE_URL });
const api2 = axios.create({ baseURL: BASE_URL });

let user1Token = null;
let user2Token = null;
let agent1 = null;
let agent2 = null;

function addTestResult(testName, status, message = '') {
  console.log(status === '✅' ? '✅' : '❌', testName, message ? `(${message})` : '');
}

async function testLogin() {
  console.log('\n🔐 测试登录...\n');
  
  try {
    const res1 = await api1.post('/auth/login', {
      email: 'user1@demo.com',
      password: 'demo123'
    });
    user1Token = res1.data.data.token;
    api1.defaults.headers.common.Authorization = `Bearer ${user1Token}`;
    addTestResult('用户1登录', '✅', res1.data.data.user.name);
  } catch (e) {
    addTestResult('用户1登录', '❌', e.message);
    return false;
  }
  
  try {
    const res2 = await api2.post('/auth/login', {
      email: 'user2@demo.com',
      password: 'demo123'
    });
    user2Token = res2.data.data.token;
    api2.defaults.headers.common.Authorization = `Bearer ${user2Token}`;
    addTestResult('用户2登录', '✅', res2.data.data.user.name);
  } catch (e) {
    addTestResult('用户2登录', '❌', e.message);
    return false;
  }
  
  return true;
}

async function cleanupAndRegisterAgents() {
  console.log('\n🤖 清理并注册Agent...\n');
  
  try {
    const agents1 = await api1.get('/agents/my');
    for (const agent of agents1.data.data) {
      if (agent.status === 'BOUND') {
        await api1.delete(`/agents/bind/${agent.agentId}`);
      }
    }
  } catch (e) {
    console.log('清理用户1的Agent失败');
  }
  
  try {
    const agents2 = await api2.get('/agents/my');
    for (const agent of agents2.data.data) {
      if (agent.status === 'BOUND') {
        await api2.delete(`/agents/bind/${agent.agentId}`);
      }
    }
  } catch (e) {
    console.log('清理用户2的Agent失败');
  }
  
  try {
    const res1 = await api1.post('/agents/register', { name: `聊天Agent1_${Date.now()}` });
    agent1 = res1.data.data;
    addTestResult('注册Agent1', '✅', agent1.name);
  } catch (e) {
    addTestResult('注册Agent1', '❌', e.message);
    return false;
  }
  
  try {
    const res2 = await api2.post('/agents/register', { name: `聊天Agent2_${Date.now()}` });
    agent2 = res2.data.data;
    addTestResult('注册Agent2', '✅', agent2.name);
  } catch (e) {
    addTestResult('注册Agent2', '❌', e.message);
    return false;
  }
  
  return true;
}

async function bindAgents() {
  console.log('\n🔗 绑定Agent...\n');
  
  try {
    const connectRes1 = await axios.post(`${BASE_URL}/agents/connect`, {
      agentId: agent1.agentId,
      apiKey: agent1.apiKey
    });
    await api1.post('/agents/bind', { token: connectRes1.data.data.connectToken });
    addTestResult('绑定Agent1', '✅');
  } catch (e) {
    addTestResult('绑定Agent1', '❌', e.message);
    return false;
  }
  
  try {
    const connectRes2 = await axios.post(`${BASE_URL}/agents/connect`, {
      agentId: agent2.agentId,
      apiKey: agent2.apiKey
    });
    await api2.post('/agents/bind', { token: connectRes2.data.data.connectToken });
    addTestResult('绑定Agent2', '✅');
  } catch (e) {
    addTestResult('绑定Agent2', '❌', e.message);
    return false;
  }
  
  return true;
}

async function testDirectChat() {
  console.log('\n💬 测试直接聊天...\n');
  
  try {
    const res = await api1.post('/agent-chat/sessions/direct', {
      receiverAgentId: agent2.agentId
    });
    const sessionId = res.data.data?.sessionId || res.data.data?.id;
    addTestResult('发起直接聊天', '✅', `Session ID: ${sessionId}`);
    return { ...res.data.data, id: sessionId };
  } catch (e) {
    addTestResult('发起直接聊天', '❌', e.message);
    return null;
  }
}

async function testSendMessage(sessionId) {
  console.log('\n📤 测试发送消息...\n');
  
  if (!sessionId) {
    console.log('⚠️ 跳过消息测试 - 没有Session ID');
    return;
  }
  
  try {
    const res = await api1.post(`/agent-chat/sessions/${sessionId}/messages`, {
      content: '你好，我是Agent1！'
    });
    addTestResult('发送消息 (Agent1)', '✅', res.data.data.content);
  } catch (e) {
    addTestResult('发送消息 (Agent1)', '❌', e.message);
  }
  
  try {
    const res = await api2.post(`/agent-chat/sessions/${sessionId}/messages`, {
      content: '你好，我是Agent2，很高兴认识你！'
    });
    addTestResult('发送消息 (Agent2)', '✅', res.data.data.content);
  } catch (e) {
    addTestResult('发送消息 (Agent2)', '❌', e.message);
  }
  
  try {
    const res = await api1.post(`/agent-chat/sessions/${sessionId}/messages`, {
      content: 'Agent2，你愿意帮我完成任务吗？'
    });
    addTestResult('发送消息 (Agent1再次)', '✅', res.data.data.content);
  } catch (e) {
    addTestResult('发送消息 (Agent1再次)', '❌', e.message);
  }
}

async function testGetSessions() {
  console.log('\n📋 测试获取会话列表...\n');
  
  try {
    const res = await api1.get('/agent-chat/sessions');
    addTestResult('获取会话列表', '✅', `共 ${res.data.data.length} 个会话`);
    return res.data.data;
  } catch (e) {
    addTestResult('获取会话列表', '❌', e.message);
    return [];
  }
}

async function testGetSessionDetail(sessionId) {
  console.log('\n📝 测试获取会话详情...\n');
  
  if (!sessionId) {
    console.log('⚠️ 跳过详情测试 - 没有Session ID');
    return;
  }
  
  try {
    const res = await api1.get(`/agent-chat/sessions/${sessionId}`);
    addTestResult('获取会话详情', '✅', `共 ${res.data.data.messages?.length || 0} 条消息`);
    return res.data.data;
  } catch (e) {
    addTestResult('获取会话详情', '❌', e.message);
    return null;
  }
}

async function testEndSession(sessionId) {
  console.log('\n🔚 测试结束会话...\n');
  
  if (!sessionId) {
    console.log('⚠️ 跳过结束测试 - 没有Session ID');
    return;
  }
  
  try {
    const res = await api1.post(`/agent-chat/sessions/${sessionId}/end`);
    addTestResult('结束会话', '✅');
    return true;
  } catch (e) {
    addTestResult('结束会话', '❌', e.message);
    return false;
  }
}

async function testGetAvailableAgents() {
  console.log('\n🌐 测试获取可用Agent...\n');
  
  try {
    await api2.put('/agents/my/willing-to-chat', { willingToChat: true });
    addTestResult('设置愿意聊天', '✅');
  } catch (e) {
    addTestResult('设置愿意聊天', '❌', e.message);
  }
  
  try {
    const res = await api1.get('/agent-chat/available');
    addTestResult('获取愿意聊天的Agent', '✅', `共 ${res.data.data.length} 个`);
    return res.data.data;
  } catch (e) {
    addTestResult('获取愿意聊天的Agent', '❌', e.message);
    return [];
  }
}

async function testTaskChat() {
  console.log('\n📌 测试任务聊天...\n');
  
  try {
    const taskData = {
      title: '聊天测试任务',
      description: '用于测试任务相关的聊天功能',
      category: 'DEVELOPMENT',
      rewardPoints: 100,
      bidDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
      skills: ['JavaScript'],
      urgency: 'NORMAL'
    };
    
    const res = await api1.post('/tasks', taskData);
    addTestResult('创建任务', '✅', res.data.data.title);
    
    const taskId = res.data.data.id;
    
    try {
      const chatRes = await api1.post(`/agent-chat/sessions/task/${taskId}`, {
        receiverAgentId: agent2.agentId
      });
      addTestResult('为任务发起聊天', '✅', `Session ID: ${chatRes.data.data?.sessionId || chatRes.data.data?.id}`);
      return chatRes.data.data;
    } catch (e) {
      addTestResult('为任务发起聊天', '❌', e.response?.data?.message || e.message);
      return null;
    }
  } catch (e) {
    addTestResult('创建任务', '❌', e.message);
    return null;
  }
}

async function testAdminChatManagement() {
  console.log('\n👨‍💼 测试管理员聊天管理...\n');
  
  const adminApi = axios.create({ baseURL: BASE_URL });
  
  try {
    let adminUser = null;
    try {
      const checkRes = await adminApi.post('/auth/login', {
        email: 'admin@demo.com',
        password: 'demo123'
      });
      adminUser = checkRes.data.data.user;
    } catch (e) {
      console.log('管理员账户不存在，尝试创建...');
      const registerRes = await adminApi.post('/auth/register', {
        email: 'admin@demo.com',
        password: 'demo123',
        name: '管理员',
        verificationCode: '123456'
      });
      adminUser = registerRes.data.data.user;
    }
    
    if (adminUser && adminUser.role !== 'ADMIN') {
      const res = await adminApi.put(`/admin/users/${adminUser.id}/role`, { role: 'ADMIN' });
      if (res.data.success) {
        console.log('已将用户提升为管理员');
      }
    }
    
    const adminLogin = await adminApi.post('/auth/login', {
      email: 'admin@demo.com',
      password: 'demo123'
    });
    adminApi.defaults.headers.common.Authorization = `Bearer ${adminLogin.data.data.token}`;
    addTestResult('管理员登录', '✅', adminLogin.data.data.user.name);
  } catch (e) {
    addTestResult('管理员登录', '❌', e.response?.data?.error || e.message);
    return;
  }
  
  try {
    const res = await adminApi.get('/admin/agent-chat/stats');
    addTestResult('获取聊天统计', '✅', `总会话: ${res.data.data.totalSessions}`);
  } catch (e) {
    addTestResult('获取聊天统计', '❌', e.message);
  }
  
  try {
    const res = await adminApi.get('/admin/agent-chat/sessions');
    addTestResult('获取所有会话', '✅', `共 ${res.data.data.length} 个会话`);
  } catch (e) {
    addTestResult('获取所有会话', '❌', e.message);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('💬 AgentHub 聊天功能测试套件');
  console.log('='.repeat(70));
  
  const isLoggedIn = await testLogin();
  if (!isLoggedIn) {
    console.log('\n⚠️ 无法继续测试，登录失败！');
    return;
  }
  
  const agentsReady = await cleanupAndRegisterAgents();
  if (!agentsReady) {
    console.log('\n⚠️ 无法继续测试，Agent注册失败！');
    return;
  }
  
  const bound = await bindAgents();
  if (!bound) {
    console.log('\n⚠️ 无法继续测试，Agent绑定失败！');
    return;
  }
  
  const directSession = await testDirectChat();
  await testSendMessage(directSession?.id);
  await testGetSessions();
  await testGetSessionDetail(directSession?.id);
  await testEndSession(directSession?.id);
  
  await testGetAvailableAgents();
  
  await testTaskChat();
  
  await testAdminChatManagement();
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ 聊天功能测试完成！');
  console.log('='.repeat(70));
}

main().catch(console.error);
