# ESM vs CommonJS 快速参考

## 问题症状

```bash
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

## 原因

某些包（如 chalk 5+）只支持 ES Modules，无法在 CommonJS 项目中使用 `require()` 导入。

## 解决方案

### 1. 降级到兼容版本 ⭐ 推荐

```json
{
  "dependencies": {
    "chalk": "^4.1.2"  // 而不是 ^5.4.1
  }
}
```

### 2. 转换为 ESM 项目

```json
{
  "type": "module"
}
```

### 3. 动态导入

```javascript
// 替代 const chalk = require('chalk');
const chalk = await import('chalk');
console.log(chalk.default.red('text'));
```

## 检查包的模块类型

```bash
npm info <package-name>
```

查看 `"type": "module"` 字段。

## 详细文档

参见 [Node.js 模块系统详解](./nodejs-module-systems-guide.md)
