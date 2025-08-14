# TODO:

- [x] create_tool_manager_component: 创建ToolManager.vue页面组件，参考OpenAPI管理页面的结构 (priority: High)
- [x] modify_server_detail_tool_management: 修改ServerDetail.vue中的Tool Management标签页，替换为MCPToolPreview组件 (priority: High)
- [x] fix_tool_fetching_logic: 修复refreshTools方法，添加mcpApi.getServerTools调用来获取MCP服务器工具列表 (priority: High)
- [x] add_missing_tools_api: 在servers控制器中添加缺失的 `/servers/{id}/tools` 接口来修复404错误 (priority: High)
- [x] fix_api_path_issue: 发现并修复API路径问题：正确路径是 `/api/v1/servers/{id}/tools` 而不是 `/api/mcp/servers/{id}/tools` (priority: High)
- [x] implement_real_tool_fetching: 修改getServerTools方法，从ServerManagerService获取真实的MCP服务器工具列表 (priority: High)
- [x] integrate_mcp_tool_preview: 集成MCPToolPreview组件来展示工具列表 (priority: Medium)
- [x] add_search_filter_functionality: 添加工具搜索和筛选功能（由MCPToolPreview组件内部处理） (priority: Medium)
- [ ] add_tool_manager_route: 在路由配置中添加Tool Management页面路由 (priority: High)
- [ ] test_tool_management_page: 测试Tool Management页面功能并预览效果 (priority: Low)
