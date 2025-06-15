# NestJS 后端项目快速搭建脚本
# 使用 PowerShell 执行: .\scripts\setup-nestjs.ps1

Write-Host "🚀 开始创建 NestJS MCP Swagger Server..." -ForegroundColor Green

# 检查 Node.js 版本
$nodeVersion = node --version
Write-Host "📋 当前 Node.js 版本: $nodeVersion" -ForegroundColor Cyan

# 创建项目目录
$projectPath = "packages\mcp-swagger-server-nestjs"
Write-Host "📁 创建项目目录: $projectPath" -ForegroundColor Cyan

if (Test-Path $projectPath) {
    Write-Host "⚠️  目录已存在，正在删除..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $projectPath
}

New-Item -ItemType Directory -Path $projectPath -Force

# 进入项目目录
Set-Location $projectPath

Write-Host "🏗️  初始化 NestJS 项目..." -ForegroundColor Cyan

# 创建基础 package.json
$packageJson = @"
{
  "name": "mcp-swagger-server-nestjs",
  "version": "1.0.0",
  "description": "NestJS-based MCP Swagger Server with enterprise architecture",
  "author": "MCP Development Team",
  "private": true,
  "license": "MIT",
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {},
  "devDependencies": {}
}
"@

Set-Content -Path "package.json" -Value $packageJson

Write-Host "📦 安装 NestJS CLI..." -ForegroundColor Cyan
npm install -g @nestjs/cli

Write-Host "📦 安装核心依赖..." -ForegroundColor Cyan
npm install @nestjs/core @nestjs/common @nestjs/platform-express
npm install @nestjs/swagger @nestjs/config class-validator class-transformer
npm install swagger-parser zod @modelcontextprotocol/sdk cors express rxjs reflect-metadata

Write-Host "📦 安装开发依赖..." -ForegroundColor Cyan
npm install -D @nestjs/cli @nestjs/schematics @nestjs/testing
npm install -D @types/express @types/cors @types/swagger-parser @types/jest @types/node
npm install -D jest ts-jest ts-loader typescript eslint prettier rimraf source-map-support

Write-Host "🔧 生成 NestJS 基础结构..." -ForegroundColor Cyan

# 使用 nest generate 创建应用结构
npx nest generate app . --flat

Write-Host "✅ NestJS 项目创建完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 下一步操作：" -ForegroundColor Yellow
Write-Host "   1. cd packages\mcp-swagger-server-nestjs" -ForegroundColor White
Write-Host "   2. npm run start:dev" -ForegroundColor White
Write-Host "   3. 访问 http://localhost:3322 查看API" -ForegroundColor White
Write-Host "   4. 访问 http://localhost:3322/docs 查看Swagger文档" -ForegroundColor White
Write-Host ""
Write-Host "🎯 项目已配置完成，可以开始开发！" -ForegroundColor Green

# 返回原目录
Set-Location ..\..
