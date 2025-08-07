# TODO:

- [x] modify_entity_metrics: 修改MCPServerEntity的metrics字段，添加startedAt?: Date属性 (priority: High)
- [x] update_server_status_method: 修改updateServerStatus方法，在状态变为RUNNING时记录启动时间 (priority: High)
- [x] update_frontend_calculation: 修改前端代码，基于startedAt实时计算运行时间 (priority: High)
- [x] test_uptime_functionality: 测试运行时间功能是否正常工作 (priority: Medium)
