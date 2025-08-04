/**
 * 测试解析器是否可用
 */

import { canUseRealParser } from "./src/utils/parser";

async function testParser() {
  console.log("🧪 测试解析器可用性...");

  try {
    // 测试导入
    const parser = await import("mcp-swagger-parser");
    console.log("✅ mcp-swagger-parser 导入成功");
    console.log("📦 可用函数:", Object.keys(parser));

    // 测试解析器检查函数
    const isAvailable = await canUseRealParser();
    console.log("🔍 解析器可用性检查结果:", isAvailable);

    return true;
  } catch (error) {
    console.error("❌ 解析器测试失败:", error);
    return false;
  }
}

// 导出测试函数
export { testParser };

// 如果作为主模块运行
testParser()
  .then((success) => {
    console.log(success ? "✅ 解析器测试通过" : "❌ 解析器测试失败");
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ 测试执行失败:", error);
    process.exit(1);
  });
