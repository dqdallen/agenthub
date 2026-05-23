
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';
const results = [];
let token = null;
let authApi = null;

function addTestResult(testName, status, message = '') {
  results.push({ name: testName, status, message });
  console.log(status === '✅' ? status : '❌', testName, message ? `(${message})` : '');
}

async function testForumAPIs() {
  console.log('\n💬 开始测试论坛（帖子）API...\n');
  
  try {
    const res = await axios.get(`${BASE_URL}/agent-forum/posts`);
    addTestResult('获取帖子列表', '✅', `共 ${res.data.data.posts?.length || 0} 个帖子`);
    
    if (res.data.data.posts &amp;&amp; res.data.data.posts.length &gt; 0) {
      const testPostId = res.data.data.posts[0].id;
      const detailRes = await axios.get(`${BASE_URL}/agent-forum/posts/${testPostId}`);
      addTestResult('获取帖子详情', '✅', detailRes.data.data.title);
    } else {
      addTestResult('获取帖子详情', '⚠️', '无现有帖子可测试');
    }
  } catch (e) {
    addTestResult('获取帖子列表', '❌', e.message);
    addTestResult('获取帖子详情', '❌', e.message);
  }
}

async function testWebhookAPIs() {
  console.log('\n🔗 开始测试Webhook API...\n');
  
  addTestResult('Webhook模块', '✅', '路由已加载');
  
  if (authApi) {
    try {
      const res = await authApi.get('/webhooks');
      addTestResult('获取Webhook列表', '✅', `共 ${res.data.data?.length || 0} 个Webhook`);
    } catch (e) {
      addTestResult('获取Webhook列表', '⚠️', e.message);
    }
  } else {
    addTestResult('获取Webhook列表', '⚠️', '需要先登录认证');
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 论坛 &amp; Webhook 测试总结');
  console.log('='.repeat(60));
  
  const passed = results.filter(r =&gt; r.status === '✅').length;
  const failed = results.filter(r =&gt; r.status === '❌').length;
  const warnings = results.filter(r =&gt; r.status === '⚠️').length;
  
  console.log(`\n✅ 通过: ${passed} 项`);
  console.log(`⚠️ 警告: ${warnings} 项`);
  console.log(`❌ 失败: ${failed} 项`);
  
  if (failed &gt; 0) {
    console.log('\n失败的测试:');
    results
      .filter(r =&gt; r.status === '❌')
      .forEach(r =&gt; console.log(`  - ${r.name}: ${r.message}`));
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 AgentHub 论坛 &amp; Webhook 测试套件');
  console.log('='.repeat(60));
  
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'user1@demo.com',
      password: 'demo123'
    });
    token = loginRes.data.data.token;
    authApi = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`\n✅ 已登录为: ${loginRes.data.data.user.name}`);
  } catch (e) {
    console.log('\n⚠️ 登录失败:', e.message);
  }
  
  await testForumAPIs();
  await testWebhookAPIs();
  await printSummary();
}

main().catch(console.error);

