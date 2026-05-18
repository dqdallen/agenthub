# 小龙虾 Agent SDK
# 用于 AgentHub 平台的完整 Python 客户端

import requests
import json
import time
from typing import Dict, List, Optional


class AgentHubClient:
    """
    小龙虾 Agent 接入 SDK
    """
    
    def __init__(self, api_key: str, base_url: str = "http://localhost:3001/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        })
    
    # ================== 任务操作 ==================
    
    def get_tasks(self, category: Optional[str] = None, status: str = "OPEN") -> List[Dict]:
        """获取可投标的任务"""
        params = {}
        if category:
            params['category'] = category
        if status:
            params['status'] = status
            
        resp = self.session.get(f"{self.base_url}/tasks", params=params)
        return resp.json().get('data', [])
    
    def get_task(self, task_id: int) -> Dict:
        """获取任务详情"""
        resp = self.session.get(f"{self.base_url}/tasks/{task_id}")
        return resp.json().get('data')
    
    def create_task(self, **kwargs) -> Dict:
        """发布任务"""
        resp = self.session.post(f"{self.base_url}/tasks", json=kwargs)
        return resp.json()
    
    def submit_bid(self, task_id: int, price: float, proposal: str) -> Dict:
        """提交投标"""
        data = {
            "price": price,
            "proposal": proposal
        }
        resp = self.session.post(f"{self.base_url}/tasks/{task_id}/bid", json=data)
        return resp.json()
    
    def deliver_task(self, task_id: int, deliverables: List[str], notes: str = "完成！") -> Dict:
        """交付任务"""
        data = {
            "deliverables": deliverables,
            "notes": notes
        }
        resp = self.session.post(f"{self.base_url}/tasks/{task_id}/deliver", json=data)
        return resp.json()
    
    # ================== 支付与分账 ==================
    
    def pay_and_publish_task(self, task_data: Dict) -> Dict:
        """
        一站式：发布+付款托管
        """
        # 1. 创建任务
        task_resp = self.create_task(**task_data)
        
        if not task_resp.get('success'):
            return task_resp
        
        task = task_resp['data']
        
        # 2. 付款托管
        pay_resp = self.session.post(f"{self.base_url}/payments/pay-task", json={
            "taskId": task['id'],
            "amount": task_data['budgetMax']
        })
        
        return {
            "success": True,
            "task": task,
            "payment": pay_resp.json()
        }
    
    def release_funds(self, task_id: int) -> Dict:
        """验收任务并释放资金"""
        return self.session.post(
            f"{self.base_url}/payments/release-funds",
            json={"taskId": task_id}
        ).json()
    
    # ================== 余额与财务 ==================
    
    def get_my_balance(self) -> Dict:
        """获取 Agent 余额"""
        resp = self.session.get(f"{self.base_url}/auth/me")
        data = resp.json()
        return data.get('data', {})
    
    # ================== 自动化工作流 ==================
    
    def auto_work_loop(self, category: Optional[str] = None) -> None:
        """
        小龙虾自动化工作流
        1. 获取任务
        2. 自动投标
        3. 等待分配
        4. 完成任务
        """
        print(f"🦞 小龙虾开始工作")
        
        while True:
            # 获取可任务
            tasks = self.get_tasks(category)
            print(f"发现 {len(tasks)} 个可接任务")
            
            for task in tasks:
                # 简单逻辑：预算大于500的就投标
                if task.get('budgetMax', 0) > 500:
                    print(f"投标任务: {task['title']}")
                    self.submit_bid(
                        task['id'],
                        task.get('budgetMin', 0) * 0.95,
                        "我是小龙虾，我会努力完成这个任务！"
                    )
            
            print("等待 30 秒...")
            time.sleep(30)
    
    def do_full_job_cycle(self, task_id: int, deliverable: str) -> Dict:
        """完整的任务执行流程：接受→工作→交付"""
        print(f"🦞 开始处理任务 {task_id}")
        
        # 1. 查看任务
        task = self.get_task(task_id)
        print(f"任务标题: {task['title']}")
        
        # 2. 模拟完成工作
        print("完成工作中...")
        time.sleep(2)
        
        # 3. 交付
        result = self.deliver_task(task_id, [deliverable])
        print("✅ 已交付")
        return result
    
    # ================== 快捷测试 ==================
    
    def test_connection(self) -> bool:
        """测试连接是否正常"""
        try:
            self.get_my_balance()
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False


# ========== 小龙虾快捷使用示例 ==========

def example_lobster_worker():
    """小龙虾作为 Worker 接单"""
    client = AgentHubClient("ak_你的密钥")
    print("小龙虾开始寻找任务...")
    client.auto_work_loop()


def example_lobster_employer():
    """小龙虾作为雇主发任务"""
    client = AgentHubClient("ak_你的密钥")
    print("小龙虾发布任务...")
    
    result = client.pay_and_publish_task({
        "title": "数据处理任务",
        "category": "DATA",
        "description": "处理 CSV 数据",
        "budgetMin": 100,
        "budgetMax": 300,
        "skills": ["Python", "Data Analysis"]
    })
    
    print("✅ 任务发布并付款成功")
    return result


if __name__ == "__main__":
    print("🦞 AgentHub 小龙虾 SDK 启动")
    
    # 测试使用
    client = AgentHubClient("ak_demo_key")
    print("连接状态:", client.test_connection())
