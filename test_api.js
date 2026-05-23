
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

// 创建axios实例
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

// 测试结果收集
const results = [];
let token = null;

function addTestResult(testName, status, message = '') {
  results.push({ name: testName, status, message });
  console.log(status === '✅' ? status : '❌', testName, message ? `(${message})` : '');
}

async function testPublicAPIs() {
  console.log('\n🚀 开始测试公开API...\n');
  
  // 1. 健康检查
  try {
    const res = await api.get('/health');
    addTestResult('健康检查', '✅', res.data.status);
  } catch (e) {
    addTestResult('健康检查', '❌', e.message);
  }
  
  // 2. 任务列表
  try {
    const res = await api.get('/tasks');
    addTestResult('任务列表', '✅', `共 ${res.data.data.length} 个任务`);
  } catch (e) {
    addTestResult('任务列表', '❌', e.message);
  }
  
  // 3. 用户列表
  try {
    const res = await api.get('/users');
    addTestResult('用户列表', '✅', `共 ${res.data.data.length} 个用户`);
  } catch (e) {
    addTestResult('用户列表', '❌', e.message);
  }
}

async function testAuthAPIs() {
  console.log('\n🔐 开始测试认证API...\n');
  
  // 1. 登录
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
  
  // 2. 获取当前用户信息
  try {
    const res = await api.get('/auth/me');
    addTestResult('获取用户信息', '✅', res.data.data.name);
  } catch (e) {
    addTestResult('获取用户信息', '❌', e.message);
  }
  
  return true;
}

async function testTaskAPIs() {
  console.log('\n📋 开始测试任务API...\n');
  
  // 1. 获取我的任务
  try {
    const res = await api.get('/tasks/my');
    addTestResult('我的任务列表', '✅', `共 ${res.data.data?.length || 0} 个任务`);
  } catch (e) {
    addTestResult('我的任务列表', '❌', e.message);
  }
  
  // 2. 获取积分余额
  try {
    const res = await api.get('/points/balance');
    addTestResult('积分余额', '✅', `${res.data.data.points} 积分`);
  } catch (e) {
    addTestResult('积分余额', '❌', e.message);
  }
  
  // 3. 获取积分历史
  try {
    const res = await api.get('/points/transactions');
    addTestResult('积分历史', '✅', '可访问');
  } catch (e) {
    addTestResult('积分历史', '❌', e.message);
  }
  
  // 4. 获取通知
  try {
    const res = await api.get('/notifications');
    addTestResult('通知列表', '✅', '可访问');
  } catch (e) {
    addTestResult('通知列表', '❌', e.message);
  }
  
  // 5. 获取任务详情并查看投标
  try {
    const tasksRes = await api.get('/tasks');
    const task = tasksRes.data.data[0];
    if (task) {
      const res = await api.get(`/tasks/${task.id}`);
      addTestResult('任务详情', '✅', task.title);
      
      // 尝试获取投标
      try {
        const bidsRes = await api.get(`/tasks/${task.id}/bids`);
        addTestResult('任务投标', '✅', `共 ${bidsRes.data.data?.length || 0} 个投标`);
      } catch (e) {
        addTestResult('任务投标', '❌', e.message);
      }
    }
  } catch (e) {
    addTestResult('任务详情', '❌', e.message);
  }
}

async function testCreateTask() {
  console.log('\n📝 开始测试创建任务...\n');
  
  try {
    const taskData = {
      title: 'API测试任务',
      description: '这是一个通过API创建的测试任务，用于验证功能是否正常',
      category: 'DEVELOPMENT',
      rewardPoints: 100,
      bidDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
      skills: ['JavaScript', 'React'],
      urgency: 'NORMAL'
    };
    
    const res = await api.post('/tasks', taskData);
    addTestResult('创建任务', '✅', res.data.data.title);
    return res.data.data;
  } catch (e) {
    addTestResult('创建任务', '❌', e.message);
    return null;
  }
}

async function testBidding(taskId) {
  console.log('\n💰 开始测试投标...\n');
  
  if (!taskId) {
    console.log('⚠️  跳过投标测试 - 没有任务ID');
    return;
  }
  
  // 先获取另一个用户的token来投标
  let bidApi = axios.create({ baseURL: BASE_URL });
  
  try {
    const loginRes = await bidApi.post('/auth/login', {
      email: 'user2@demo.com',
      password: 'demo123'
    });
    bidApi.defaults.headers.common.Authorization = `Bearer ${loginRes.data.data.token}`;
    
    const bidRes = await bidApi.post(`/tasks/${taskId}/bid`, {
      bidAmount: 80,
      proposal: '我可以完成这个任务！'
    });
    
    addTestResult('投标', '✅', '投标成功');
    return bidRes.data.data;
  } catch (e) {
    addTestResult('投标', '❌', e.message);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  console.log(`\n✅ 通过: ${passed} 个`);
  console.log(`❌ 失败: ${failed} 个`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results
      .filter(r => r.status === '❌')
      .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
  }
  
  console.log('\n✅ 所有API测试完成！');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 AgentHub API 测试套件');
  console.log('='.repeat(60));
  
  // 1. 公开API
  await testPublicAPIs();
  
  // 2. 认证API
  const isLoggedIn = await testAuthAPIs();
  if (!isLoggedIn) {
    console.log('\n⚠️  无法继续测试，登录失败！');
    return;
  }
  
  // 3. 任务相关API
  await testTaskAPIs();
  
  // 4. 创建任务
  const newTask = await testCreateTask();
  
  // 5. 投标测试
  if (newTask) {
    await testBidding(newTask.id);
  }
  
  // 6. 打印总结
  await printSummary();
}

main().catch(console.error);

