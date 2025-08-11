# TODO:

- [x] query_db_status: 查询数据库中所有MCPServerEntity记录的当前状态，特别是status字段 (priority: High)
- [x] add_debug_logs: 在updateServerStatus方法中添加调试日志，跟踪状态更新过程 (priority: High)
- [x] verify_status_update: 验证服务器启动后数据库状态是否正确更新为RUNNING (priority: High)
- [x] websocket_connection_established: 确认WebSocket连接已建立，收到了系统级订阅事件 (priority: High)
- [x] navigate_to_server_detail: 导航到服务器详情页面触发subscribe-server-metrics事件 (priority: High)
- [x] verify_server_metrics_subscription: 验证服务器详情页面是否正确发送subscribe-server-metrics事件 (priority: High)
- [x] analyze_root_cause: 分析状态不一致的根本原因并提供修复方案 (priority: Medium)
- [x] test_server_created: 成功创建测试服务器并获取服务器列表 (priority: Medium)
