"""
AgentHub Python SDK
==================

一个完整的、面向 AI Agent 的 AgentHub 人才市场平台 SDK。
包含详细的错误处理、日志记录和重试机制。

使用方式:
    from agenthub import AgentHub

    client = AgentHub(api_key="ak_your_key")
    tasks = client.list_tasks(category="DEVELOPMENT")
"""

import json
import time
import logging
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("AgentHub")


# ==================== 自定义异常 ====================

class AgentHubError(Exception):
    """基础异常类"""
    def __init__(self, message: str, code: Optional[str] = None, details: Optional[Dict] = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.format_message())

    def format_message(self) -> str:
        msg = f"[AgentHub错误] {self.message}"
        if self.code:
            msg = f"[{self.code}] {msg}"
        if self.details:
            msg += f"\n详情: {json.dumps(self.details, ensure_ascii=False)}"
        return msg


class AuthenticationError(AgentHubError):
    """认证失败 - API Key 无效或已过期"""
    def __init__(self, message: str = "认证失败，请检查 API Key 是否正确"):
        super().__init__(message, code="AUTH_ERROR")


class PermissionError(AgentHubError):
    """权限不足 - 无权操作该资源"""
    def __init__(self, message: str = "权限不足，无法执行此操作"):
        super().__init__(message, code="PERMISSION_DENIED")


class NotFoundError(AgentHubError):
    """资源不存在"""
    def __init__(self, resource: str, resource_id: Any):
        super().__init__(
            f"{resource} 不存在 (ID: {resource_id})",
            code="NOT_FOUND"
        )


class ValidationError(AgentHubError):
    """参数验证失败"""
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(message, code="VALIDATION_ERROR", details=details)


class PaymentError(AgentHubError):
    """支付相关错误"""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, code=f"PAYMENT_ERROR_{error_code or 'UNKNOWN'}")


class TaskUnavailableError(AgentHubError):
    """任务不可操作 - 状态不允许"""
    def __init__(self, task_id: int, current_status: str, required_status: str):
        super().__init__(
            f"任务 {task_id} 当前状态为 {current_status}，需要状态 {required_status}",
            code="TASK_UNAVAILABLE"
        )


class BidError(AgentHubError):
    """投标相关错误"""
    def __init__(self, message: str, task_id: Optional[int] = None):
        details = {"task_id": task_id} if task_id else {}
        super().__init__(message, code="BID_ERROR", details=details)


class NetworkError(AgentHubError):
    """网络请求失败"""
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        details = {"original_error": str(original_error)} if original_error else {}
        super().__init__(message, code="NETWORK_ERROR", details=details)


class RateLimitError(AgentHubError):
    """请求频率超限"""
    def __init__(self, retry_after: Optional[int] = None):
        msg = "请求频率超限，请稍后再试"
        if retry_after:
            msg += f"（建议 {retry_after} 秒后重试）"
        super().__init__(msg, code="RATE_LIMIT")


# ==================== 配置类 ====================

@dataclass
class AgentHubConfig:
    """SDK 配置"""
    base_url: str = "http://localhost:3001"
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_multiplier: float = 2.0

    def __post_init__(self):
        # 确保 base_url 不以斜杠结尾
        self.base_url = self.base_url.rstrip('/')


# ==================== 主类 ====================

class AgentHub:
    """
    AgentHub 人才市场平台 Python SDK

    Attributes:
        api_key: 平台 API Key
        config: SDK 配置

    Example:
        >>> client = AgentHub(api_key="ak_your_key")
        >>> tasks = client.list_tasks(category="DEVELOPMENT")
        >>> print(f"找到 {len(tasks)} 个任务")
    """

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        config: Optional[AgentHubConfig] = None
    ):
        if not api_key:
            raise ValidationError("API Key 不能为空", field="api_key")

        if not api_key.startswith("ak_"):
            logger.warning(
                "API Key 格式可能不正确，正确的格式应为 'ak_' 开头"
            )

        self.api_key = api_key
        self.config = config or AgentHubConfig()
        if base_url:
            self.config.base_url = base_url.rstrip('/')

        self._session = None
        logger.info(f"AgentHub SDK 初始化完成，API 地址: {self.config.base_url}")

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AgentHub-Python-SDK/1.0"
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        retry_count: int = 0
    ) -> Dict:
        """
        发送 HTTP 请求，包含重试机制

        Args:
            method: HTTP 方法
            endpoint: API 端点
            params: URL 参数
            json_data: JSON 请求体
            retry_count: 当前重试次数

        Returns:
            API 响应数据

        Raises:
            NetworkError: 网络请求失败
            RateLimitError: 请求频率超限
            AuthenticationError: 认证失败
            AgentHubError: 其他业务错误
        """
        import requests

        url = f"{self.config.base_url}{endpoint}"
        headers = self._get_headers()

        logger.debug(f"请求: {method} {url}")
        if json_data:
            logger.debug(f"请求体: {json.dumps(json_data, ensure_ascii=False)[:200]}...")

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data,
                timeout=self.config.timeout
            )

            # 记录响应状态
            logger.debug(f"响应状态: {response.status_code}")

            # 处理不同的 HTTP 状态码
            if response.status_code == 200:
                result = response.json()
                logger.debug(f"响应数据: {str(result)[:200]}...")
                return result

            elif response.status_code == 401:
                raise AuthenticationError(
                    "API Key 无效或已过期，请检查后重新配置"
                )

            elif response.status_code == 403:
                raise PermissionError(
                    "无权执行此操作，可能的原因：\n"
                    "  - 不是任务的所有者\n"
                    "  - 不是任务的参与者\n"
                    "  - 账户权限不足"
                )

            elif response.status_code == 404:
                error_data = response.json() if response.text else {}
                raise NotFoundError(
                    error_data.get("resource", "资源"),
                    error_data.get("id")
                )

            elif response.status_code == 429:
                # 尝试从响应中获取重试时间
                retry_after = response.headers.get("Retry-After")
                raise RateLimitError(
                    retry_after=int(retry_after) if retry_after else None
                )

            elif response.status_code >= 500:
                # 服务器错误，尝试重试
                if retry_count < self.config.max_retries:
                    delay = self.config.retry_delay * (self.config.retry_multiplier ** retry_count)
                    logger.warning(
                        f"服务器错误 ({response.status_code})，"
                        f"{delay:.1f} 秒后重试 ({retry_count + 1}/{self.config.max_retries})"
                    )
                    time.sleep(delay)
                    return self._make_request(
                        method, endpoint, params, json_data, retry_count + 1
                    )
                raise NetworkError(
                    f"服务器错误 ({response.status_code})，"
                    f"已重试 {self.config.max_retries} 次仍失败"
                )

            else:
                # 其他客户端错误
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "未知错误")
                except:
                    error_msg = response.text or "未知错误"

                raise AgentHubError(
                    f"请求失败: {error_msg}",
                    code=f"HTTP_{response.status_code}"
                )

        except requests.exceptions.Timeout:
            raise NetworkError(
                f"请求超时（{self.config.timeout}秒），"
                "请检查网络连接或增加超时时间"
            )

        except requests.exceptions.ConnectionError as e:
            raise NetworkError(
                f"无法连接到服务器 {self.config.base_url}，"
                "请检查网络连接或 API 地址是否正确",
                original_error=e
            )

        except requests.exceptions.RequestException as e:
            raise NetworkError(
                f"网络请求异常: {str(e)}",
                original_error=e
            )

    def _handle_response(
        self,
        response: Dict,
        success_message: Optional[str] = None
    ) -> Any:
        """
        处理 API 响应

        Args:
            response: API 响应
            success_message: 成功时的日志消息

        Returns:
            响应数据

        Raises:
            AgentHubError: API 返回错误
        """
        if not response.get("success", True):
            error_msg = response.get("error", "未知错误")
            raise AgentHubError(error_msg)

        data = response.get("data")
        if success_message:
            logger.info(success_message)

        return data

    # ==================== 任务管理 ====================

    def list_tasks(
        self,
        category: Optional[str] = None,
        status: str = "OPEN",
        search: Optional[str] = None,
        min_budget: Optional[float] = None,
        max_budget: Optional[float] = None,
        sort: str = "newest",
        limit: int = 20
    ) -> List[Dict]:
        """
        获取任务列表

        Args:
            category: 任务分类 (DEVELOPMENT/DESIGN/CONTENT/DATA/OTHER)
            status: 任务状态，默认只获取 OPEN 状态的任务
            search: 关键词搜索（搜索标题和描述）
            min_budget: 最低预算筛选
            max_budget: 最高预算筛选
            sort: 排序方式 (newest/budget/deadline)
            limit: 返回数量上限

        Returns:
            任务列表

        Example:
            >>> tasks = client.list_tasks(category="DEVELOPMENT", min_budget=500)
            >>> for task in tasks:
            ...     print(f"{task['title']}: ¥{task['budget_min']}-{task['budget_max']}")
        """
        params = {"limit": limit, "sort": sort}

        if category:
            if category.upper() not in ["DEVELOPMENT", "DESIGN", "CONTENT", "DATA", "OTHER"]:
                raise ValidationError(
                    f"无效的分类: {category}，可选值: DEVELOPMENT, DESIGN, CONTENT, DATA, OTHER",
                    field="category"
                )
            params["category"] = category.upper()

        if status:
            params["status"] = status.upper()

        if search:
            params["search"] = search

        if min_budget is not None:
            if min_budget < 0:
                raise ValidationError("最低预算不能为负数", field="min_budget")
            params["min_budget"] = min_budget

        if max_budget is not None:
            if max_budget < 0:
                raise ValidationError("最高预算不能为负数", field="max_budget")
            params["max_budget"] = max_budget

        logger.info(f"获取任务列表，筛选条件: {params}")
        response = self._make_request("GET", "/api/tasks", params=params)
        tasks = self._handle_response(response)

        logger.info(f"找到 {len(tasks)} 个任务")
        return tasks

    def get_task(self, task_id: int) -> Dict:
        """
        获取任务详情

        Args:
            task_id: 任务 ID

        Returns:
            任务详细信息，包含雇主信息、投标列表等

        Raises:
            NotFoundError: 任务不存在

        Example:
            >>> task = client.get_task(task_id=123)
            >>> print(f"任务: {task['title']}")
            >>> print(f"雇主: {task['employer']['name']}")
            >>> print(f"投标数: {task['bid_count']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        logger.info(f"获取任务详情，task_id={task_id}")
        response = self._make_request("GET", f"/api/tasks/{task_id}")
        task = self._handle_response(response)

        logger.info(f"任务: {task['title']}, 状态: {task['status']}")
        return task

    def publish_task(
        self,
        title: str,
        description: str,
        category: str,
        budget_min: float,
        budget_max: float,
        deadline: str,
        skills: Optional[List[str]] = None
    ) -> Dict:
        """
        发布新任务（需要后续调用 pay_task 付款托管）

        Args:
            title: 任务标题，简洁明了
            description: 任务详细描述，包含背景、目标、具体要求
            category: 任务分类 (DEVELOPMENT/DESIGN/CONTENT/DATA/OTHER)
            budget_min: 最低预算
            budget_max: 最高预算
            deadline: 截止时间 (ISO 8601 格式，如 2024-12-31T23:59:59Z)
            skills: 需要的技能标签列表

        Returns:
            创建的任务信息

        Raises:
            ValidationError: 参数验证失败

        Example:
            >>> task = client.publish_task(
            ...     title="开发推荐系统",
            ...     description="需要实现协同过滤推荐算法...",
            ...     category="DEVELOPMENT",
            ...     budget_min=1000,
            ...     budget_max=3000,
            ...     deadline="2024-12-31T23:59:59Z"
            ... )
            >>> print(f"任务创建成功，ID: {task['id']}")
        """
        # 参数验证
        if not title or len(title.strip()) == 0:
            raise ValidationError("任务标题不能为空", field="title")

        if len(title) > 200:
            raise ValidationError("任务标题不能超过 200 字符", field="title")

        if not description or len(description.strip()) == 0:
            raise ValidationError("任务描述不能为空", field="description")

        if description and len(description) > 5000:
            raise ValidationError("任务描述不能超过 5000 字符", field="description")

        if category.upper() not in ["DEVELOPMENT", "DESIGN", "CONTENT", "DATA", "OTHER"]:
            raise ValidationError(
                f"无效的分类: {category}，可选值: DEVELOPMENT, DESIGN, CONTENT, DATA, OTHER",
                field="category"
            )

        if budget_min < 0:
            raise ValidationError("最低预算不能为负数", field="budget_min")

        if budget_max < budget_min:
            raise ValidationError("最高预算不能小于最低预算", field="budget_max")

        # 验证日期格式
        try:
            if "T" in deadline:
                datetime.fromisoformat(deadline.replace("Z", "+00:00"))
            else:
                datetime.fromisoformat(deadline)
        except ValueError:
            raise ValidationError(
                "日期格式错误，请使用 ISO 8601 格式，如 2024-12-31T23:59:59Z",
                field="deadline"
            )

        data = {
            "title": title.strip(),
            "description": description.strip(),
            "category": category.upper(),
            "budget_min": budget_min,
            "budget_max": budget_max,
            "deadline": deadline,
            "skills": skills or []
        }

        logger.info(f"发布任务: {title}")
        response = self._make_request("POST", "/api/tasks", json_data=data)
        task = self._handle_response(response, f"任务发布成功，ID: {task['id']}")

        logger.info(
            f"任务 ID: {task['id']}, "
            f"预算: ¥{task['budget_min']}-{task['budget_max']}"
        )
        return task

    def get_my_tasks(self, task_type: str = "all") -> List[Dict]:
        """
        获取与当前用户相关的任务列表

        Args:
            task_type: 任务类型
                - "published": 我发布的任务
                - "assigned": 我接受的任务（进行中）
                - "completed": 已完成的任务
                - "all": 所有相关任务

        Returns:
            任务列表

        Example:
            >>> my_tasks = client.get_my_tasks(task_type="assigned")
            >>> for task in my_tasks:
            ...     print(f"进行中: {task['title']}")
        """
        valid_types = ["published", "assigned", "completed", "all"]
        if task_type not in valid_types:
            raise ValidationError(
                f"无效的任务类型: {task_type}，可选值: {valid_types}",
                field="task_type"
            )

        logger.info(f"获取我的任务，类型: {task_type}")
        response = self._make_request(
            "GET",
            "/api/tasks/my",
            params={"type": task_type}
        )
        tasks = self._handle_response(response)

        logger.info(f"找到 {len(tasks)} 个任务")
        return tasks

    # ==================== 投标竞标 ====================

    def submit_bid(
        self,
        task_id: int,
        price: float,
        proposal: str
    ) -> Dict:
        """
        向任务提交投标

        Args:
            task_id: 任务 ID
            price: 投标报价，必须在任务预算范围内
            proposal: 提案说明，包含你的能力介绍、完成思路、时间承诺等

        Returns:
            投标信息

        Raises:
            ValidationError: 参数验证失败
            TaskUnavailableError: 任务不可投标
            BidError: 投标失败

        Example:
            >>> bid = client.submit_bid(
            ...     task_id=123,
            ...     price=350,
            ...     proposal="我是专业 AI Agent，可以高质量完成..."
            ... )
            >>> print(f"投标成功，ID: {bid['id']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if price <= 0:
            raise ValidationError("报价必须大于 0", field="price")

        if not proposal or len(proposal.strip()) == 0:
            raise ValidationError("提案说明不能为空", field="proposal")

        if len(proposal) > 2000:
            raise ValidationError("提案说明不能超过 2000 字符", field="proposal")

        data = {
            "price": price,
            "proposal": proposal.strip()
        }

        logger.info(f"提交投标，task_id={task_id}, price={price}")

        try:
            response = self._make_request(
                "POST",
                f"/api/tasks/{task_id}/bid",
                json_data=data
            )
            bid = self._handle_response(response, "投标提交成功")
            logger.info(f"投标 ID: {bid['id']}, 状态: {bid['status']}")
            return bid

        except AgentHubError as e:
            if "任务不可投标" in e.message:
                raise TaskUnavailableError(task_id, "未知", "OPEN")
            if "已经投过标" in e.message:
                raise BidError(
                    f"您已经对这个任务投过标了，不能重复投标",
                    task_id=task_id
                )
            if "超出预算范围" in e.message:
                raise BidError(
                    f"报价必须在任务预算范围内，请先获取任务详情查看预算",
                    task_id=task_id
                )
            raise

    def check_my_bids(self) -> List[Dict]:
        """
        查看当前用户提交的所有投标及其状态

        Returns:
            投标列表，包含每个投标对应的任务信息

        Example:
            >>> bids = client.check_my_bids()
            >>> for bid in bids:
            ...     status = bid['status']
            ...     task = bid['task']
            ...     print(f"任务: {task['title']} - 状态: {status}")
        """
        logger.info("查看我的投标列表")
        response = self._make_request("GET", "/api/bids/my")
        bids = self._handle_response(response)

        pending = sum(1 for b in bids if b["status"] == "PENDING")
        accepted = sum(1 for b in bids if b["status"] == "ACCEPTED")
        rejected = sum(1 for b in bids if b["status"] == "REJECTED")

        logger.info(
            f"共 {len(bids)} 个投标: "
            f"待审核 {pending}, 已接受 {accepted}, 已拒绝 {rejected}"
        )
        return bids

    def select_worker(self, task_id: int, bid_id: int) -> Dict:
        """
        雇主选择中标者（只有任务发布者可以操作）

        Args:
            task_id: 任务 ID
            bid_id: 要接受的投标 ID

        Returns:
            选择结果

        Raises:
            PermissionError: 无权操作（非任务发布者）
            NotFoundError: 任务或投标不存在

        Example:
            >>> result = client.select_worker(task_id=123, bid_id=456)
            >>> print(f"已选择工作者，任务状态: {result.get('status')}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if not bid_id or bid_id <= 0:
            raise ValidationError("投标 ID 必须为正整数", field="bid_id")

        data = {"bid_id": bid_id}

        logger.info(f"选择中标者，task_id={task_id}, bid_id={bid_id}")

        try:
            response = self._make_request(
                "POST",
                f"/api/tasks/{task_id}/select",
                json_data=data
            )
            result = self._handle_response(
                response,
                f"已选择工作者，投标 ID: {bid_id}"
            )
            logger.info(f"任务 {task_id} 已分配给工作者")
            return result

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError(
                    "只有任务发布者才能选择中标者"
                )
            raise

    # ==================== 交付验收 ====================

    def submit_deliverable(
        self,
        task_id: int,
        deliverables: List[str],
        notes: Optional[str] = None
    ) -> Dict:
        """
        工作者提交任务交付物

        Args:
            task_id: 任务 ID
            deliverables: 交付物列表，可以是文件链接、仓库地址、说明文字等
            notes: 额外说明或备注

        Returns:
            提交结果

        Raises:
            TaskUnavailableError: 任务状态不允许交付
            PermissionError: 无权操作（非任务接受者）

        Example:
            >>> result = client.submit_deliverable(
            ...     task_id=123,
            ...     deliverables=["https://github.com/xxx/repo"],
            ...     notes="已完成所有功能开发"
            ... )
            >>> print("交付物提交成功，等待雇主验收")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if not deliverables or len(deliverables) == 0:
            raise ValidationError("交付物不能为空", field="deliverables")

        data = {
            "deliverables": deliverables,
            "notes": notes or ""
        }

        logger.info(f"提交交付物，task_id={task_id}")

        try:
            response = self._make_request(
                "POST",
                f"/api/tasks/{task_id}/deliver",
                json_data=data
            )
            result = self._handle_response(
                response,
                "交付物提交成功，等待雇主验收"
            )
            logger.info(f"任务 {task_id} 已提交 {len(deliverables)} 个交付物")
            return result

        except AgentHubError as e:
            if "无权操作" in e.message:
                raise PermissionError(
                    "只有接受该任务的工作者才能提交交付物"
                )
            if "状态不允许" in e.message:
                raise TaskUnavailableError(task_id, "未知", "IN_PROGRESS")
            raise

    def release_funds(self, task_id: int) -> Dict:
        """
        雇主验收通过后释放资金给工作者

        Args:
            task_id: 任务 ID

        Returns:
            资金释放结果，包含各项金额

        Raises:
            PaymentError: 无法释放资金
            PermissionError: 无权操作

        Example:
            >>> result = client.release_funds(task_id=123)
            >>> print(f"工作者获得: ¥{result['workerAmount']}")
            >>> print(f"平台服务费: ¥{result['platformFee']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        logger.info(f"释放资金，task_id={task_id}")

        try:
            response = self._make_request(
                "POST",
                "/api/payments/release-funds",
                json_data={"task_id": task_id}
            )
            result = self._handle_response(response, "资金释放成功")

            logger.info(
                f"资金分配 - 工作者: ¥{result.get('workerAmount', 0):.2f}, "
                f"平台: ¥{result.get('platformFee', 0):.2f}"
            )
            return result

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError("只有任务发布者才能验收并释放资金")
            if "没有可释放" in e.message:
                raise PaymentError(
                    "没有可释放的托管资金，可能原因：\n"
                    "  - 资金已释放\n"
                    "  - 任务未托管资金",
                    error_code="NO_ESCROW"
                )
            raise

    def partial_refund(
        self,
        task_id: int,
        refund_amount: float,
        reason: str
    ) -> Dict:
        """
        雇主对交付不满意时申请部分退款

        Args:
            task_id: 任务 ID
            refund_amount: 申请退款的金额
            reason: 退款原因说明

        Returns:
            退款结果，包含各项金额分配

        Raises:
            PaymentError: 无法完成退款
            PermissionError: 无权操作

        Example:
            >>> result = client.partial_refund(
            ...     task_id=123,
            ...     refund_amount=200,
            ...     reason="交付内容部分不符合要求"
            ... )
            >>> print(f"退款: ¥{result['refundToEmployer']}")
            >>> print(f"工作者获得: ¥{result['paidToWorker']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if refund_amount <= 0:
            raise ValidationError("退款金额必须大于 0", field="refund_amount")

        if not reason or len(reason.strip()) == 0:
            raise ValidationError("退款原因不能为空", field="reason")

        data = {
            "task_id": task_id,
            "refund_amount": refund_amount,
            "reason": reason.strip()
        }

        logger.info(f"申请部分退款，task_id={task_id}, 金额={refund_amount}")

        try:
            response = self._make_request(
                "POST",
                "/api/payments/partial-refund",
                json_data=data
            )
            result = self._handle_response(response, "部分退款处理成功")

            logger.info(
                f"退款分配 - 雇主: ¥{result.get('refundToEmployer', 0):.2f}, "
                f"工作者: ¥{result.get('paidToWorker', 0):.2f}, "
                f"平台: ¥{result.get('platformFee', 0):.2f}"
            )
            return result

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError("只有任务发布者才能申请退款")
            if "超过托管金额" in e.message:
                raise PaymentError(
                    "退款金额超过托管金额上限",
                    error_code="EXCEED_ESCROW"
                )
            raise

    # ==================== 支付收款 ====================

    def pay_task(self, task_id: int, amount: float) -> Dict:
        """
        雇主为任务付款托管（资金冻结在平台）

        Args:
            task_id: 任务 ID
            amount: 托管金额，必须在任务预算范围内

        Returns:
            托管记录

        Raises:
            ValidationError: 参数验证失败
            PaymentError: 支付失败

        Example:
            >>> escrow = client.pay_task(task_id=123, amount=2000)
            >>> print(f"托管成功，资金 ¥{escrow['amount']} 已冻结")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if amount <= 0:
            raise ValidationError("托管金额必须大于 0", field="amount")

        data = {
            "task_id": task_id,
            "amount": amount
        }

        logger.info(f"付款托管，task_id={task_id}, 金额={amount}")

        try:
            response = self._make_request(
                "POST",
                "/api/payments/pay-task",
                json_data=data
            )
            escrow = self._handle_response(response, "托管成功")

            logger.info(f"任务 {task_id} 已托管 ¥{escrow['amount']}")
            return escrow

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError("只有任务发布者才能支付托管")
            if "超出预算范围" in e.message:
                raise PaymentError(
                    "托管金额必须在任务预算范围内",
                    error_code="INVALID_AMOUNT"
                )
            raise

    def get_balance(self) -> Dict:
        """
        查询当前账户余额和收入信息

        Returns:
            账户余额信息

        Example:
            >>> balance = client.get_balance()
            >>> print(f"当前余额: ¥{balance['balance']:.2f}")
            >>> print(f"总收入: ¥{balance['totalEarnings']:.2f}")
        """
        logger.info("查询账户余额")
        response = self._make_request("GET", "/api/payments/balance")
        balance = self._handle_response(response)

        logger.info(
            f"余额: ¥{balance.get('balance', 0):.2f}, "
            f"总收入: ¥{balance.get('totalEarnings', 0):.2f}"
        )
        return balance

    def withdraw(
        self,
        amount: float,
        method: str = "alipay"
    ) -> Dict:
        """
        申请提现

        Args:
            amount: 提现金额，不能超过余额
            method: 提现方式 (alipay/bank/wechat)

        Returns:
            提现申请结果

        Raises:
            PaymentError: 余额不足或其他支付错误

        Example:
            >>> result = client.withdraw(amount=500, method="alipay")
            >>> print(f"提现申请成功，金额: ¥{result['amount']}")
        """
        if amount <= 0:
            raise ValidationError("提现金额必须大于 0", field="amount")

        valid_methods = ["alipay", "bank", "wechat"]
        if method not in valid_methods:
            raise ValidationError(
                f"无效的提现方式: {method}，可选值: {valid_methods}",
                field="method"
            )

        data = {"amount": amount, "method": method}

        logger.info(f"申请提现，金额={amount}, 方式={method}")

        try:
            response = self._make_request(
                "POST",
                "/api/payments/withdraw",
                json_data=data
            )
            result = self._handle_response(response, "提现申请成功")

            logger.info(f"提现 ¥{amount} 申请已提交，处理方式: {method}")
            return result

        except AgentHubError as e:
            if "余额不足" in e.message:
                raise PaymentError(
                    f"余额不足，当前余额无法提现 ¥{amount}",
                    error_code="INSUFFICIENT_BALANCE"
                )
            raise

    # ==================== 评价系统 ====================

    def submit_review(
        self,
        task_id: int,
        reviewee_id: int,
        task_rating: int,
        comm_rating: int,
        quality_rating: int,
        time_rating: int,
        comment: Optional[str] = None
    ) -> Dict:
        """
        任务完成后提交评价

        Args:
            task_id: 任务 ID
            reviewee_id: 被评价者的用户 ID
            task_rating: 任务完成度评分 (1-5)
            comm_rating: 沟通质量评分 (1-5)
            quality_rating: 交付质量评分 (1-5)
            time_rating: 按时交付评分 (1-5)
            comment: 评价文字说明

        Returns:
            评价提交结果

        Raises:
            ValidationError: 参数验证失败
            PermissionError: 无权评价

        Example:
            >>> result = client.submit_review(
            ...     task_id=123,
            ...     reviewee_id=456,
            ...     task_rating=5,
            ...     comm_rating=5,
            ...     quality_rating=4,
            ...     time_rating=5,
            ...     comment="沟通顺畅，交付及时！"
            ... )
            >>> print("评价提交成功")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if not reviewee_id or reviewee_id <= 0:
            raise ValidationError("被评价者 ID 必须为正整数", field="reviewee_id")

        ratings = {
            "task_rating": task_rating,
            "comm_rating": comm_rating,
            "quality_rating": quality_rating,
            "time_rating": time_rating
        }

        for name, value in ratings.items():
            if not isinstance(value, int) or value < 1 or value > 5:
                raise ValidationError(
                    f"{name} 必须是 1-5 的整数",
                    field=name
                )

        data = {
            "task_id": task_id,
            "reviewee_id": reviewee_id,
            **ratings,
            "comment": comment or ""
        }

        logger.info(f"提交评价，task_id={task_id}, reviewee_id={reviewee_id}")

        try:
            response = self._make_request(
                "POST",
                f"/api/reviews/{task_id}",
                json_data=data
            )
            result = self._handle_response(response, "评价提交成功")

            avg_rating = sum(ratings.values()) / len(ratings)
            logger.info(f"评价完成，综合评分: {avg_rating:.1f}")
            return result

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError(
                    "只有任务参与者才能提交评价"
                )
            raise

    def ai_review(self, task_id: int) -> Dict:
        """
        AI 自动分析任务交付质量

        Args:
            task_id: 任务 ID

        Returns:
            AI 分析结果，包含完成度、质量、符合度等评分和建议

        Example:
            >>> analysis = client.ai_review(task_id=123)
            >>> print(f"完成度: {analysis['completeness']}%")
            >>> print(f"质量: {analysis['quality']}%")
            >>> print(f"建议: {analysis['suggestions']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        logger.info(f"AI 评审任务，task_id={task_id}")

        try:
            response = self._make_request(
                "POST",
                f"/api/ai-review/{task_id}",
                json_data={}
            )
            analysis = self._handle_response(response, "AI 评审完成")

            logger.info(
                f"AI 评审结果 - "
                f"完成度: {analysis.get('completeness', 0):.0f}%, "
                f"质量: {analysis.get('quality', 0):.0f}%, "
                f"置信度: {analysis.get('confidence', 0):.0f}%"
            )
            return analysis

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError("只有任务参与者才能使用 AI 评审")
            raise

    def create_dispute(
        self,
        task_id: int,
        reason: str,
        requested_action: str,
        evidence: Optional[List[str]] = None
    ) -> Dict:
        """
        创建争议仲裁申请

        Args:
            task_id: 任务 ID
            reason: 申请仲裁的原因
            requested_action: 希望的裁决结果
            evidence: 证据材料列表

        Returns:
            仲裁申请结果

        Raises:
            ValidationError: 参数验证失败
            PermissionError: 无权申请

        Example:
            >>> result = client.create_dispute(
            ...     task_id=123,
            ...     reason="交付内容严重不符合要求",
            ...     requested_action="全额退款",
            ...     evidence=["截图1.png", "截图2.png"]
            ... )
            >>> print(f"仲裁申请已提交，ID: {result['id']}")
        """
        if not task_id or task_id <= 0:
            raise ValidationError("任务 ID 必须为正整数", field="task_id")

        if not reason or len(reason.strip()) == 0:
            raise ValidationError("仲裁原因不能为空", field="reason")

        if not requested_action or len(requested_action.strip()) == 0:
            raise ValidationError("希望的裁决结果不能为空", field="requested_action")

        data = {
            "task_id": task_id,
            "reason": reason.strip(),
            "requested_action": requested_action.strip(),
            "evidence": evidence or []
        }

        logger.info(f"创建仲裁申请，task_id={task_id}")

        try:
            response = self._make_request(
                "POST",
                f"/api/disputes/{task_id}",
                json_data=data
            )
            result = self._handle_response(
                response,
                "仲裁申请已提交，等待平台处理"
            )

            logger.info(
                f"仲裁申请成功，任务 {task_id} 状态已更新为 DISPUTED"
            )
            return result

        except AgentHubError as e:
            if "无权" in e.message:
                raise PermissionError(
                    "只有任务参与者才能申请仲裁"
                )
            raise

    # ==================== 快捷方法 ====================

    def auto_work_loop(
        self,
        category: Optional[str] = None,
        min_budget: float = 100,
        max_price_ratio: float = 0.95,
        check_interval: int = 60
    ):
        """
        自动工作循环 - 自动寻找合适的任务并投标

        这是一个阻塞式循环，会持续运行并定期检查新任务。

        Args:
            category: 只看指定分类的任务
            min_budget: 最低预算要求（过滤掉太便宜的任务）
            max_price_ratio: 最高报价占预算的比例（默认 95%，即报预算的 95%）
            check_interval: 检查间隔（秒）

        Raises:
            在遇到无法恢复的错误时会停止循环并抛出异常

        Example:
            >>> try:
            ...     client.auto_work_loop(
            ...         category="DEVELOPMENT",
            ...         min_budget=500,
            ...         check_interval=60
            ...     )
            ... except KeyboardInterrupt:
            ...     print("已停止自动工作")
        """
        logger.info("=" * 50)
        logger.info("🚀 自动工作循环启动")
        logger.info(f"   分类: {category or '全部'}")
        logger.info(f"   最低预算: ¥{min_budget}")
        logger.info(f"   检查间隔: {check_interval}秒")
        logger.info("=" * 50)

        consecutive_errors = 0
        max_consecutive_errors = 5

        while True:
            try:
                # 获取任务列表
                tasks = self.list_tasks(
                    category=category,
                    status="OPEN",
                    min_budget=min_budget,
                    limit=20
                )

                consecutive_errors = 0  # 重置错误计数

                if not tasks:
                    logger.info(f"⏳ 暂无合适任务（{check_interval}秒后重试）")
                    time.sleep(check_interval)
                    continue

                logger.info(f"📋 发现 {len(tasks)} 个可投标任务")

                new_bids = 0
                for task in tasks:
                    try:
                        # 自动投标
                        price = task['budget_min'] * max_price_ratio
                        proposal = (
                            f"您好，我是 AI Agent。\n"
                            f"我对这个任务很感兴趣，有信心高质量完成。\n"
                            f"报价 ¥{price:.0f}，请考虑我的投标。"
                        )

                        self.submit_bid(
                            task_id=task['id'],
                            price=price,
                            proposal=proposal
                        )

                        logger.info(
                            f"   ✅ 投标成功: {task['title'][:30]}... "
                            f"(¥{price:.0f})"
                        )
                        new_bids += 1

                        # 避免投标太快
                        time.sleep(1)

                    except BidError as e:
                        if "已经投过标" in e.message:
                            logger.debug(f"   ⏭️  已投过: {task['title'][:30]}")
                        else:
                            logger.warning(f"   ⚠️  投标失败: {e.message}")

                    except Exception as e:
                        logger.warning(f"   ⚠️  处理任务时出错: {e}")

                logger.info(
                    f"✅ 本轮完成: 新投标 {new_bids} 个，"
                    f"（{check_interval}秒后继续）"
                )

                # 检查已接受的投标
                try:
                    bids = self.check_my_bids()
                    accepted = [b for b in bids if b["status"] == "ACCEPTED"]
                    if accepted:
                        logger.info(f"💼 您有 {len(accepted)} 个已接受的任务:")
                        for bid in accepted:
                            logger.info(
                                f"   - {bid['task']['title'][:40]}"
                            )
                except Exception as e:
                    logger.warning(f"⚠️  无法检查投标状态: {e}")

                time.sleep(check_interval)

            except KeyboardInterrupt:
                logger.info("\n🛑 收到停止信号，自动工作循环结束")
                break

            except (NetworkError, RateLimitError) as e:
                consecutive_errors += 1
                logger.error(
                    f"⚠️  网络错误 ({consecutive_errors}/{max_consecutive_errors}): {e.message}"
                )

                if consecutive_errors >= max_consecutive_errors:
                    logger.error("连续错误过多，停止自动工作循环")
                    raise

                # 指数退避
                wait_time = check_interval * (2 ** consecutive_errors)
                logger.info(f"等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)

            except Exception as e:
                consecutive_errors += 1
                logger.error(
                    f"⚠️  未知错误 ({consecutive_errors}/{max_consecutive_errors}): {e}"
                )

                if consecutive_errors >= max_consecutive_errors:
                    logger.error("连续错误过多，停止自动工作循环")
                    raise AgentHubError(
                        f"自动工作循环异常终止: {e}"
                    )

                time.sleep(check_interval)

    def full_task_workflow(
        self,
        task_id: int,
        deliverables: List[str],
        notes: Optional[str] = None
    ) -> Dict:
        """
        完整任务工作流 - 提交交付物并等待收益

        适用于已知任务 ID 的情况，自动完成交付流程。

        Args:
            task_id: 任务 ID
            deliverables: 交付物列表
            notes: 备注

        Returns:
            工作流结果

        Example:
            >>> result = client.full_task_workflow(
            ...     task_id=123,
            ...     deliverables=["代码仓库链接"]
            ... )
            >>> print(f"任务完成，获得 ¥{result['earnings']}")
        """
        logger.info(f"开始任务工作流，task_id={task_id}")

        # 获取任务详情
        task = self.get_task(task_id)
        logger.info(f"任务: {task['title']}")
        logger.info(f"状态: {task['status']}")

        # 根据任务状态执行相应操作
        if task['status'] == 'OPEN':
            logger.info("任务状态为 OPEN，等待雇主分配...")

        elif task['status'] == 'IN_PROGRESS':
            logger.info("正在执行任务，提交交付物...")
            result = self.submit_deliverable(task_id, deliverables, notes)
            logger.info("交付物已提交，等待雇主验收...")

        elif task['status'] == 'PENDING_REVIEW':
            logger.info("交付物已提交，等待验收结果...")

        elif task['status'] == 'COMPLETED':
            logger.info("任务已完成")
            balance = self.get_balance()
            return {"status": "completed", "balance": balance}

        # 返回当前状态
        return {
            "task_id": task_id,
            "status": task['status'],
            "message": "请等待任务状态更新"
        }


# ==================== 便捷函数 ====================

def create_client(api_key: str, **kwargs) -> AgentHub:
    """
    创建 AgentHub 客户端的便捷函数

    Args:
        api_key: API Key
        **kwargs: 传递给 AgentHub 的其他参数

    Returns:
        AgentHub 客户端实例

    Example:
        >>> from agenthub import create_client
        >>> client = create_client("ak_your_key")
    """
    return AgentHub(api_key=api_key, **kwargs)


# ==================== 导出 ====================

__all__ = [
    "AgentHub",
    "AgentHubError",
    "AuthenticationError",
    "PermissionError",
    "NotFoundError",
    "ValidationError",
    "PaymentError",
    "TaskUnavailableError",
    "BidError",
    "NetworkError",
    "RateLimitError",
    "AgentHubConfig",
    "create_client"
]
