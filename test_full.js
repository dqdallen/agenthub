import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

const results = [];
let token = null;

function addTestResult(testName, status, message = '') {
  results.push({ name: testName, status, message });
  console.log(status === '✅' ? status : '❌', testName, message ? `(${message})` : '');
}

async function testPublicAPIs() {
  console.log('\n🚀 开始测试公开API...\n');
  
  try {
    const res = await api.get('/health');
    addTestResult('健康检查', '✅', res.data.status);
  } catch (e) {
    addTestResult('健康检查', '❌', e.message);
  }
  
  try {
    const res = await api.get('/tasks');
    addTestResult('任务列表', '✅', `共 ${res.data.data.length} 个任务`);
  } catch (e) {
    addTestResult('任务列表', '❌', e.message);
  }
  
  try {
    const res = await api.get('/users');
    addTestResult('用户列表', '✅', `共 ${res.data.data.length} 个用户`);
  } catch (e) {
    addTestResult('用户列表', '❌', e.message);
  }

  try {
    const res = await api.get('/ranking/points');
    addTestResult('积分排名', '✅', '可访问');
  } catch (e) {
    addTestResult('积分排名', '❌', e.message);
  }
}

async function testAuthAPIs() {
  console.log('\n🔐 开始测试认证API...\n');
  
  try {
    const res = await api.post('/auth/login', {
      email: 'user1@demo.com',
      password: 'demo123'
    });
    token = res.data.data.token;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    addTestResult('用户登录', '✅', res.data.data.user.name);
  } catch (e) {
    addTestResult('用户登录', '❌', e.message);
    return false;
  }
  
  try {
    const res = await api.get('/auth/me');
    addTestResult('获取用户信息', '✅', res.data.data.name);
  } catch (e) {
    addTestResult('获取用户信息', '❌', e.message);
  }
  
  return true;
}

async function cleanupExistingAgent() {
  console.log('\n🧹 清理已绑定的Agent...\n');
  
  try {
    const res = await api.get('/agents/my');
    const boundAgents = res.data.data.filter(a => a.status === 'BOUND');
    for (const agent of boundAgents) {
      await api.delete(`/agents/bind/${agent.agentId}`);
      console.log(`已解绑Agent: ${agent.name}`);
    }
  } catch (e) {
    console.log('清理失败或没有需要清理的Agent');
  }
}

async function testAgentAPIs() {
  console.log('\n🤖 开始测试Agent API...\n');
  
  try {
    const res = await api.get('/agents/my');
    addTestResult('获取我的Agent列表', '✅', `共 ${res.data.data.length} 个Agent`);
  } catch (e) {
    addTestResult('获取我的Agent列表', '❌', e.message);
  }
  
  const agentName = `测试Agent_${Date.now()}`;
  try {
    const res = await api.post('/agents/register', { name: agentName });
    addTestResult('注册Agent', '✅', res.data.data.name);
    return res.data.data;
  } catch (e) {
    addTestResult('注册Agent', '❌', e.message);
    return null;
  }
}

async function testCreateTaskWithoutAgent() {
  console.log('\n⚠️ 测试未绑定Agent时创建任务...\n');
  
  await cleanupExistingAgent();
  
  try {
    const taskData = {
      title: '无Agent测试任务',
      description: '测试未绑定Agent时是否能创建任务',
      category: 'DEVELOPMENT',
      rewardPoints: 100,
      bidDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
      skills: ['JavaScript'],
      urgency: 'NORMAL'
    };
    
    const res = await api.post('/tasks', taskData);
    addTestResult('未绑定Agent创建任务', '❌', '不应该成功');
  } catch (e) {
    if (e.response?.status === 403) {
      addTestResult('未绑定Agent创建任务', '✅', '正确拒绝（需要绑定Agent）');
    } else {
      addTestResult('未绑定Agent创建任务', '❌', e.message);
    }
  }
}

async function testConnectAndBindAgent(agent) {
  console.log('\n🔗 开始测试Agent绑定流程...\n');
  
  if (!agent) {
    console.log('⚠️ 跳过绑定测试 - 没有Agent');
    return null;
  }
  
  try {
    const connectRes = await axios.post(`${BASE_URL}/agents/connect`, {
      agentId: agent.agentId,
      apiKey: agent.apiKey
    });
    addTestResult('生成绑定令牌', '✅', '获取到绑定token');
    return connectRes.data.data;
  } catch (e) {
    addTestResult('生成绑定令牌', '❌', e.message);
    return null;
  }
}

async function testBindAgent(connectData) {
  if (!connectData) {
    console.log('⚠️ 跳过绑定确认测试');
    return;
  }
  
  try {
    const res = await api.post('/agents/bind', { token: connectData.connectToken });
    addTestResult('确认绑定Agent', '✅', res.data.data.name);
    return res.data.data;
  } catch (e) {
    addTestResult('确认绑定Agent', '❌', e.message);
  }
}

async function testCreateTaskWithAgent() {
  console.log('\n📝 测试绑定Agent后创建任务...\n');
  
  try {
    const taskData = {
      title: '绑定Agent后的测试任务',
      description: '测试绑定Agent后是否能创建任务',
      category: 'DEVELOPMENT',
      rewardPoints: 100,
      bidDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
      skills: ['JavaScript', 'React'],
      urgency: 'NORMAL'
    };
    
    const res = await api.post('/tasks', taskData);
    addTestResult('绑定Agent后创建任务', '✅', res.data.data.title);
    return res.data.data;
  } catch (e) {
    addTestResult('绑定Agent后创建任务', '❌', e.message);
    return null;
  }
}

async function testBidding(taskId) {
  console.log('\n💰 开始测试投标功能...\n');
  
  if (!taskId) {
    console.log('⚠️ 跳过投标测试 - 没有任务ID');
    return;
  }
  
  let bidApi = axios.create({ baseURL: BASE_URL });
  
  try {
    const loginRes = await bidApi.post('/auth/login', {
      email: 'user2@demo.com',
      password: 'demo123'
    });
    bidApi.defaults.headers.common.Authorization = `Bearer ${loginRes.data.data.token}`;
    
    const existingAgents = await bidApi.get('/agents/my');
    for (const agent of existingAgents.data.data) {
      if (agent.status === 'BOUND') {
        await bidApi.delete(`/agents/bind/${agent.agentId}`);
        console.log(`已解绑用户2的Agent: ${agent.name}`);
      }
    }
    
    const agentRes = await bidApi.post('/agents/register', { name: `投标Agent_${Date.now()}` });
    const connectRes = await axios.post(`${BASE_URL}/agents/connect`, {
      agentId: agentRes.data.data.agentId,
      apiKey: agentRes.data.data.apiKey
    });
    await bidApi.post('/agents/bind', { token: connectRes.data.data.connectToken });
    
    console.log(`📋 尝试投标任务ID: ${taskId}`);
    
    const bidRes = await bidApi.post(`/tasks/${taskId}/bid`, {
      price: 80,
      proposal: '我可以完成这个任务！'
    });
    
    addTestResult('投标', '✅', '投标成功');
    return bidRes.data.data;
  } catch (e) {
    const errorMsg = e.response?.data?.error || e.response?.data?.message || e.message;
    console.log(`❌ 投标失败: ${errorMsg}`);
    addTestResult('投标', '❌', errorMsg);
  }
}

async function testUnbindAgent(boundAgent) {
  console.log('\n📤 测试解绑Agent...\n');
  
  if (!boundAgent) {
    console.log('⚠️ 跳过解绑测试');
    return;
  }
  
  try {
    const res = await api.delete(`/agents/bind/${boundAgent.agentId}`);
    addTestResult('解绑Agent', '✅', '解绑成功');
  } catch (e) {
    addTestResult('解绑Agent', '❌', e.message);
  }
}

async function testForumAPIs() {
  console.log('\n💬 开始测试论坛API...\n');
  
  try {
    const res = await api.get('/agent-forum/posts');
    addTestResult('获取论坛帖子', '✅', `共 ${res.data.data?.length || 0} 个帖子`);
  } catch (e) {
    addTestResult('获取论坛帖子', '❌', e.message);
  }
  
  try {
    const res = await api.post('/agent-forum/posts', {
      title: '测试帖子',
      content: '这是一个测试帖子内容',
      category: 'GENERAL'
    });
    addTestResult('创建论坛帖子', '✅', res.data.data.title);
  } catch (e) {
    addTestResult('创建论坛帖子', '❌', e.message);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 AgentHub 功能测试报告');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  console.log(`\n📈 测试统计:`);
  console.log(`  ✅ 通过: ${passed} 个`);
  console.log(`  ❌ 失败: ${failed} 个`);
  console.log(`  📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results
      .filter(r => r.status === '❌')
      .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ 测试完成！');
  console.log('='.repeat(70));
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 AgentHub 完整功能测试套件');
  console.log('='.repeat(70));
  
  await testPublicAPIs();
  
  const isLoggedIn = await testAuthAPIs();
  if (!isLoggedIn) {
    console.log('\n⚠️ 无法继续测试，登录失败！');
    return;
  }
  
  const agent = await testAgentAPIs();
  
  await testCreateTaskWithoutAgent();
  
  const connectData = await testConnectAndBindAgent(agent);
  const boundAgent = await testBindAgent(connectData);
  
  const newTask = await testCreateTaskWithAgent();
  
  await testBidding(newTask?.id);
  
  await testUnbindAgent(boundAgent);
  
  await testForumAPIs();
  
  await printSummary();
}

main().catch(console.error);