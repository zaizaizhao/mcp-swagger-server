/**
 * WebSocket连接测试脚本
 * 在浏览器控制台中运行此脚本来测试连接稳定性
 */

import { websocketService } from "@/services/websocket";

// 测试WebSocket连接稳定性
async function testWebSocketConnection() {
  console.log("🔍 开始WebSocket连接测试...");

  const startTime = Date.now();
  let connectionLost = false;
  const subscriptionConfirmed = false;

  // 监听连接状态
  websocketService.on("connect", () => {
    console.log("✅ WebSocket连接成功");
  });

  websocketService.on("disconnect", () => {
    console.log("❌ WebSocket连接断开");
    connectionLost = true;
  });

  // 测试订阅
  const testServerId = "test-server-id";

  try {
    // 连接
    await websocketService.connect();
    console.log("📡 WebSocket连接建立");

    // 等待一秒确保连接稳定
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (connectionLost) {
      console.error("❌ 连接在1秒内丢失");
      return false;
    }

    // 测试订阅
    console.log("📥 测试订阅功能...");
    websocketService.subscribeToProcessInfo(testServerId);

    // 等待订阅确认
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (connectionLost) {
      console.error("❌ 订阅过程中连接丢失");
      return false;
    }

    console.log("✅ 测试完成 - 连接保持稳定");
    return true;
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
    return false;
  }
}

// 持续监控连接状态
function startConnectionMonitoring() {
  console.log("🔍 开始连接状态监控...");

  const checkInterval = setInterval(() => {
    const connected = websocketService.isConnected();
    const info = websocketService.getConnectionInfo();

    console.log(`🔍 连接状态检查: ${connected ? "✅ 已连接" : "❌ 未连接"}`, {
      重连次数: info.reconnectAttempts,
      正在连接: info.isConnecting,
    });

    if (!connected && !info.isConnecting) {
      console.warn("⚠️ 检测到连接丢失，尝试重新连接...");
      websocketService.connect().catch((err: any) => {
        console.error("❌ 重连失败:", err);
      });
    }
  }, 5000);

  // 返回停止函数
  return () => {
    clearInterval(checkInterval);
    console.log("🛑 连接监控已停止");
  };
}

// 导出到全局作用域
(window as any).wsTest = {
  test: testWebSocketConnection,
  monitor: startConnectionMonitoring,
  connect: () => websocketService.connect(),
  disconnect: () => websocketService.disconnect(),
  status: () => websocketService.getConnectionInfo(),
  subscribe: (serverId: string) =>
    websocketService.subscribeToProcessInfo(serverId),
};

console.log("🛠️ WebSocket测试工具已加载");
console.log("📋 可用命令:");
console.log("- wsTest.test() - 运行连接测试");
console.log("- wsTest.monitor() - 开始连接监控");
console.log("- wsTest.connect() - 手动连接");
console.log("- wsTest.disconnect() - 手动断开");
console.log("- wsTest.status() - 查看连接状态");
console.log("- wsTest.subscribe(serverId) - 订阅服务器指标");
