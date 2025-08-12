# TODO:

- [x] fix_transport_type_display: 修复传输类型显示错误，从固定的'SSE'改为根据实际配置显示正确的传输类型 (priority: High)
- [x] fix_performance_metrics_display: 修复性能监控数据显示N/A的问题，从processInfo.resourceMetrics获取CPU和内存数据 (priority: High)
- [x] fix_port_transport_fields: 修复端口和传输类型字段读取，确保从serverInfo.port和serverInfo.transport直接读取 (priority: High)
- [x] fix_cpu_usage_inconsistency: 修复CPU使用率显示不一致问题：统一服务器概览和进程监控页面的CPU使用率计算和显示逻辑 (priority: High)
- [x] fix_canvas_cpu_percentage: 修复canvas图表中CPU使用率显示问题，将CPU数据乘以100以正确显示为百分比 (priority: High)
- [x] fix_process_id_display: 修复进程ID显示问题：修改process-manager.service.ts中setupEventListeners方法，确保前端能够接收到正确的进程ID (priority: High)
- [x] separate_process_logs_tab: 将进程日志从进程监控标签页中独立出来，创建一个新的标签页用于展示MCP server的日志 (priority: High)
- [x] fix_runtime_display_consistency: 修复运行时长显示不一致问题：导入formatDuration函数并统一两个页面的运行时长显示逻辑 (priority: High)
- [x] ensure_realtime_updates: 确保概览页面能实时更新监控数据，当WebSocket推送新数据时自动更新 (priority: Medium)
- [x] test_overview_page_fixes: 测试修复后的概览页面是否能正确显示传输类型和监控数据，以及卡片高度是否一致 (priority: Medium)
