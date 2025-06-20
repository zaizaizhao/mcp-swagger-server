#!/usr/bin/env ts-node
/**
 * 测试新的 mcp-swagger-parser 集成
 */

import { transformOpenApiToMcpTools } from './src/transform';

async function testParser() {
  console.log('🧪 测试新的 mcp-swagger-parser 集成...\n');
  
  try {
    // 测试解析和转换
    const tools = await transformOpenApiToMcpTools();
    
    console.log('\n📊 解析结果统计:');
    console.log(`✅ 总工具数量: ${tools.length}`);
    
    // 按标签分组统计
    const tagStats: Record<string, number> = {};
    const methodStats: Record<string, number> = {};
    
    tools.forEach(tool => {
      // 统计标签
      const tags = tool.metadata?.tags || ['未分类'];
      tags.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });
      
      // 统计方法
      const method = tool.metadata?.method || '未知';
      methodStats[method] = (methodStats[method] || 0) + 1;
    });
    
    console.log('\n📂 按标签分类:');
    Object.entries(tagStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count} 个工具`);
      });
    
    console.log('\n🔧 按HTTP方法分类:');
    Object.entries(methodStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([method, count]) => {
        console.log(`  ${method}: ${count} 个工具`);
      });
    
    // 显示前几个工具的详细信息
    console.log('\n🔍 工具示例 (前3个):');
    tools.slice(0, 3).forEach((tool, index) => {
      console.log(`\n${index + 1}. 🛠️ ${tool.name}`);
      console.log(`   📝 描述: ${tool.description}`);
      console.log(`   🌐 方法: ${tool.metadata?.method} ${tool.metadata?.path}`);
      console.log(`   📋 参数数量: ${Object.keys(tool.inputSchema.properties || {}).length}`);
      console.log(`   🏷️ 标签: ${tool.metadata?.tags?.join(', ') || '无'}`);
    });
    
    console.log('\n✅ 测试完成！新的解析器工作正常。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testParser().catch(console.error);
