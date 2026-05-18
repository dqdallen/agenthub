#!/bin/bash

echo "=========================================="
echo "AgentHub 完整功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
test_endpoint() {
    local name=$1
    local expected_status=$2
    shift 2
    local response=$(curl -s -w "\n%{http_code}" "$@")
    local status=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $status)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name (期望: $expected_status, 实际: $status)"
        echo "  响应: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1. 检查后端服务状态..."
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} 后端服务未运行，正在启动..."
    cd /workspace
    node server/index.js > /tmp/server.log 2>&1 &
    sleep 3

    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} 后端服务启动成功"
    else
        echo -e "${RED}✗${NC} 后端服务启动失败"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} 后端服务运行正常"
fi
echo ""

echo "2. 测试基础 API 接口..."
test_endpoint "健康检查" "200" http://localhost:3001/api/health
test_endpoint "OpenAPI文档" "200" http://localhost:3001/api/openapi.json
test_endpoint "API Docs页面" "200" http://localhost:3001/api/docs
echo ""

echo "3. 测试用户认证接口..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123456","name":"Test User","role":"WORKER"}')

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓${NC} 用户注册成功"
    ((TESTS_PASSED++))
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}✗${NC} 用户注册失败: $REGISTER_RESPONSE"
    ((TESTS_FAILED++))
    TOKEN=""
fi

# 测试登录
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123456"}')

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓${NC} 用户登录成功"
    ((TESTS_PASSED++))
    if [ -z "$TOKEN" ]; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    fi
else
    echo -e "${RED}✗${NC} 用户登录失败: $LOGIN_RESPONSE"
    ((TESTS_FAILED++))
fi

# 测试获取当前用户信息
if [ -n "$TOKEN" ]; then
    test_endpoint "获取当前用户" "200" http://localhost:3001/api/auth/me \
        -H "Authorization: Bearer $TOKEN"
fi
echo ""

echo "4. 测试任务接口..."
# 测试获取任务列表
test_endpoint "获取任务列表" "200" http://localhost:3001/api/tasks

# 测试创建任务
if [ -n "$TOKEN" ]; then
    CREATE_TASK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/tasks \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "title": "测试任务",
            "description": "这是一个测试任务",
            "category": "development",
            "budgetMin": 100,
            "budgetMax": 500,
            "deadline": "2026-12-31",
            "skills": ["JavaScript", "React"]
        }')

    if echo "$CREATE_TASK_RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓${NC} 创建任务成功"
        ((TESTS_PASSED++))
        TASK_ID=$(echo "$CREATE_TASK_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    else
        echo -e "${RED}✗${NC} 创建任务失败: $CREATE_TASK_RESPONSE"
        ((TESTS_FAILED++))
        TASK_ID=""
    fi
fi

# 测试获取单个任务
if [ -n "$TASK_ID" ]; then
    test_endpoint "获取任务详情" "200" "http://localhost:3001/api/tasks/$TASK_ID"
fi
echo ""

echo "5. 测试 Agent 接口..."
# 测试 Agent 注册
if [ -n "$TOKEN" ]; then
    AGENT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/agents/onboard \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "autonomous": false,
            "agentName": "TestAgent",
            "description": "测试Agent",
            "capabilityTags": ["coding", "testing"]
        }')

    if echo "$AGENT_RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓${NC} Agent注册成功"
        ((TESTS_PASSED++))
        API_KEY=$(echo "$AGENT_RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
    else
        echo -e "${RED}✗${NC} Agent注册失败: $AGENT_RESPONSE"
        ((TESTS_FAILED++))
    fi
fi
echo ""

echo "6. 测试前端构建..."
cd /workspace
if npm run build > /tmp/build.log 2>&1; then
    echo -e "${GREEN}✓${NC} 前端构建成功"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} 前端构建失败"
    ((TESTS_FAILED++))
    echo "查看日志: cat /tmp/build.log"
fi
echo ""

echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！项目已准备就绪！${NC}"
    exit 0
else
    echo -e "${RED}⚠${NC} 存在 $TESTS_FAILED 个测试失败，请检查上述输出"
    exit 1
fi
