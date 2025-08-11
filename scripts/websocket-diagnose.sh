#!/bin/bash

echo "🔍 WebSocket连接诊断工具"
echo "=========================="

# 1. 检查后端服务是否运行
echo "1. 检查后端服务..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常 (端口3001)"
else
    echo "❌ 后端服务无响应 (端口3001)"
fi

# 2. 检查WebSocket端点
echo "2. 检查WebSocket端点..."
if curl -s -I http://localhost:3001/socket.io/ | grep -q "400 Bad Request"; then
    echo "✅ Socket.IO端点可访问"
else
    echo "❌ Socket.IO端点不可访问"
fi

# 3. 检查静态文件
echo "3. 检查测试页面..."
if curl -s http://localhost:3001/websocket-test.html | grep -q "WebSocket"; then
    echo "✅ 测试页面可访问"
    echo "   📱 请访问: http://localhost:3001/websocket-test.html"
else
    echo "❌ 测试页面不可访问"
fi

# 4. 检查进程
echo "4. 检查相关进程..."
if pgrep -f "nest.js start" > /dev/null; then
    echo "✅ NestJS开发服务器正在运行"
else
    echo "❌ NestJS开发服务器未运行"
fi

if pgrep -f "mcp-swagger-api/dist/src/main" > /dev/null; then
    echo "✅ 后端主服务正在运行"
else
    echo "❌ 后端主服务未运行"
fi

echo ""
echo "🚀 下一步操作建议："
echo "1. 访问测试页面: http://localhost:3001/websocket-test.html"
echo "2. 尝试连接并订阅，观察控制台输出"
echo "3. 同时查看终端中的后端日志"
echo "4. 如果有问题，将日志信息反馈给我"

echo ""
echo "📝 测试用的服务器ID: f196a4c8-118b-4ce8-946e-8c8e80be63bd"
