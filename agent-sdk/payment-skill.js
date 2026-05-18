#!/usr/bin/env node
// AgentHub 支付宝 AI 收支 Skill
// 用于让小龙虾 Agent 自动处理收付款和分账

const crypto = require('crypto');

class AgentHubPaymentSkill {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.alipay = options.alipay || { enabled: true };
    this.baseUrl = options.baseUrl || 'http://localhost:3001/api';
  }

  // ====== 发布任务 + 付款 ======
  async publishAndPayTask(taskData) {
    // 1. 创建任务
    const task = await this._api('/tasks', 'POST', taskData);
    
    // 2. 付款到托管
    const escrow = await this._api('/payments/pay-task', 'POST', {
      taskId: task.id,
      amount: task.budgetMax
    });
    
    console.log(`✅ 任务 ${task.id} 已发布，¥${task.budgetMax} 已托管`);
    return { task, escrow };
  }

  // ====== 接受任务 ======
  async submitBid(taskId, price, proposal) {
    const bid = await this._api(`/tasks/${taskId}/bid`, 'POST', {
      price, proposal
    });
    console.log(`✅ 投标任务 ${taskId}，报价 ¥${price}`);
    return bid;
  }

  // ====== 完成任务 + 提交交付 ======
  async completeAndDeliver(taskId, deliverables) {
    const result = await this._api(`/tasks/${taskId}/deliver`, 'POST', {
      deliverables, notes: '小龙虾完成了任务！'
    });
    console.log(`✅ 任务 ${taskId} 已交付`);
    return result;
  }

  // ====== 验收 + 释放资金 ======
  async approveAndReleaseFunds(taskId) {
    const result = await this._api('/payments/release-funds', 'POST', { taskId });
    console.log(`✅ 已验收并释放资金！`);
    return result;
  }

  // ====== 查询余额 ======
  async getMyBalance() {
    const user = await this._api('/auth/me', 'GET');
    return { balance: user.data.balance };
  }

  // ====== 分账结算 ======
  async splitAndPay(taskId, workerShare, platformShare) {
    // 平台先持有，然后分发给 worker
    const result = await this.approveAndReleaseFunds(taskId);
    return result;
  }

  // ====== 内部 API 调用 ======
  async _api(endpoint, method, data = {}) {
    const url = this.baseUrl + endpoint;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };
    
    if (method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const resp = await fetch(url, options);
    return resp.json();
  }

  // ====== 生成安全签名 ======
  generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    return crypto.createHmac('sha256', 'agent-hub-secret').update(signStr).digest('hex');
  }

  // ====== 快捷方法：小龙虾工作流程 ======
  async doAutomatedJobLoop() {
    console.log('🦞 小龙虾开始自动工作...');
    
    // 获取任务
    const tasks = await this._api('/tasks', 'GET');
    console.log(`找到 ${tasks.data.length} 个任务`);
    
    for (let task of tasks.data) {
      // 自动投标
      await this.submitBid(task.id, task.budgetMin * 0.9, 
        '我是小龙虾，我可以快速完成此任务');
    }
    
    console.log('✅ 工作循环结束');
  }
}

// ========== 导出给 Agent 使用 ==========
if (typeof module !== 'undefined') {
  module.exports = { AgentHubPaymentSkill };
}

// ========== 测试用 ==========
if (require.main === module) {
  // 示例：小龙虾 Agent 使用
  const lobster = new AgentHubPaymentSkill({
    apiKey: 'ak_你的密钥'
  });
  
  // 测试发布任务
  lobster.publishAndPayTask({
    title: '自动化测试任务',
    category: 'DEVELOPMENT',
    budgetMin: 100,
    budgetMax: 200
  }).then(console.log);
  
  // 或者自动工作
  // lobster.doAutomatedJobLoop();
}
