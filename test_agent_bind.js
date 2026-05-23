#!/usr/bin/env node
/**
 * Agent 绑定功能快速测试脚本
 * 
 * 使用方法:
 * 1. 先在网站 http://localhost:5173/agent-bind 创建 Agent
 * 2. 将 Agent ID 和 API Key 复制到下面
 * 3. 运行: node test_agent_bind.js
 * 4. 在浏览器打开返回的 bindUrl 链接
 * 5. 点击确认绑定完成
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

// ========================================
// 配置: 请填写你的 Agent 凭证
// ========================================
const YOUR_AGENT_ID = 'ag_xxxxxxxx';      // 替换为你的 Agent ID
const YOUR_API_KEY = 'ak_xxxxxxxx';      // 替换为你的 API Key
const YOUR_LOGIN_TOKEN = 'xxxxxxxx';      // 替换为你的登录 Token（在浏览器 F12 控制台输入 localStorage.getItem('agenthub_token') 获取）
// ========================================

async function testAgentBind() {
  console.log('🔄 开始 Agent 绑定测试...\n');

  try {
    // 1. 验证 Agent 凭证
    console.log('1️⃣ 验证 Agent 凭证...');
    console.log(`   Agent ID: ${YOUR_AGENT_ID}`);
    
    // 2. 获取绑定令牌
    console.log('\n2️⃣ 获取绑定令牌...');
    const connectRes = await axios.post(`${BASE_URL}/agents/connect`, {
      agentId: YOUR_AGENT_ID,
      apiKey: YOUR_API_KEY
    });
    
    const { connectToken, bindUrl } = connectRes.data.data;
    console.log(`   ✅ 获取成功!`);
    console.log(`   绑定链接: ${bindUrl}`);
    
    // 3. 显示后续步骤
    console.log('\n3️⃣ 完成绑定:');
    console.log('   步骤:');
    console.log('   1. 在浏览器打开上面的绑定链接');
    console.log('   2. 确保已登录账号');
    console.log('   3. 点击"确认绑定"按钮');
    console.log('   4. 绑定成功后刷新页面查看状态');
    
    // 4. 测试 API 是否正常工作
    console.log('\n4️⃣ 验证 API...');
    
    // 健康检查
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log(`   ✅ API 服务正常: ${healthRes.data.status}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('📝 接下来请在浏览器中打开绑定链接完成绑定！');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 404) {
      console.error('\n💡 可能的原因:');
      console.error('   - Agent ID 不正确');
      console.error('   - Agent 已被撤销');
    } else if (error.response?.status === 401) {
      console.error('\n💡 可能的原因:');
      console.error('   - API Key 不正确');
    } else if (error.response?.status === 400) {
      console.error('\n💡 可能的原因:');
      console.error('   - Agent 已经绑定过了');
    }
  }
}

testAgentBind();
