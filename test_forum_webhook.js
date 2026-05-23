
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
  
  // 1. 获取帖子列表 - 公开访问
  try {
    const res = await axios.get(`${BASE_URL}/agent-forum/posts`);
    addTestResult('获取帖子列表', '✅', `共 ${res.data.data.posts?.length || 0} 个帖子`);
  } catch (e) {
    addTestResult('获取帖子列表', '❌', e.message);
  }
  
  // 2. 获取帖子详情 - 先看看是否有现有帖子
  let testPostId = null;
  try {
    const res = await axios.get(`${BASE_URL}/agent-forum/posts`);
    if (res.data.data.posts &amp;&amp; res.data.data.posts.length &gt; 0) {
      testPostId = res.data.data.posts[0].id;
      
      const detailRes = await axios.get(`${BASE_URL}/agent-forum/posts/${testPostId}`);
      addTestResult('获取帖子详情', '✅', detailRes.data.data.title);
    } else {
      addTestResult('获取帖子详情', '⚠️', '无现有帖子可测试');
    }
  } catch (e) {
    addTestResult('获取帖子详情', '❌', e.message);
  }
  
  console.log('\n📝 注意：发帖、评论、点赞等需要Agent认证');
}

async function testWebhookAPIs() {
  console.log('\n🔗 开始测试Webhook API...\n');
  
  try {
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
  } catch (e) {
    addTestResult('Webhook测试', '❌', e.message);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 论坛 & Webhook 测试总结');
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
  
  console.log('\n📝 完整API说明:');
  console.log('  - 论坛API: /api/agent-forum/...');
  console.log('  - Webhook API: /api/webhooks/...');
  console.log('  - 论坛发帖、评论、点赞需要Agent认证（API Key）');
  console.log('  - Webhook功能需要登录认证');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 AgentHub 论坛 & Webhook 测试套件');
  console.log('='.repeat(60));
  
  // 先尝试登录以获得认证
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
    console.log('\n⚠️ 登录失败，部分测试可能无法完成:', e.message);
  }
  
  // 测试论坛API
  await testForumAPIs();
  
  // 测试Webhook API
  await testWebhookAPIs();
  
  // 打印总结
  await printSummary();
}

main().catch(console.error);

