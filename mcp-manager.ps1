# MCP Server Manager PowerShell Script
# 用于在 Windows 上管理 MCP 服务器

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Command = "start",
    
    [string]$Transport = "sse",
    [int]$Port = 3322,
    [string]$Endpoint = "/sse",
    [int]$MaxRetries = 5,
    [int]$RetryDelay = 1000,
    [int]$HealthCheck = 30000,
    [int]$MemoryLimit = 512,
    [string]$LogLevel = "info",
    [string]$Config = "mcp-config.json",
    [switch]$Daemon,
    [switch]$Help
)

# 显示帮助信息
if ($Help) {
    Write-Host @"
MCP Server Manager - PowerShell 版本

用法: .\mcp-manager.ps1 [命令] [选项]

命令:
  start     启动 MCP 服务器 (默认)
  stop      停止 MCP 服务器
  restart   重启 MCP 服务器
  status    显示服务器状态
  logs      显示服务器日志

选项:
  -Transport <type>      传输协议: stdio, sse, streamable (默认: sse)
  -Port <port>           服务器端口 (默认: 3322)
  -Endpoint <path>       端点路径 (默认: /sse)
  -MaxRetries <num>      最大重试次数 (默认: 5)
  -RetryDelay <ms>       重试延迟毫秒 (默认: 1000)
  -HealthCheck <ms>      健康检查间隔毫秒 (默认: 30000)
  -MemoryLimit <mb>      内存限制MB (默认: 512)
  -LogLevel <level>      日志级别: debug, info, warn, error (默认: info)
  -Config <file>         配置文件路径 (默认: mcp-config.json)
  -Daemon                后台运行模式
  -Help                  显示帮助信息

示例:
  # 启动基本的 MCP 服务器
  .\mcp-manager.ps1 start

  # 使用自定义配置启动
  .\mcp-manager.ps1 start -Port 8080 -Transport streamable -MemoryLimit 1024

  # 重启服务器
  .\mcp-manager.ps1 restart

  # 查看状态
  .\mcp-manager.ps1 status
"@
    exit 0
}

# 文件路径
$PidFile = "mcp-server.pid"
$LogFile = "mcp-server.log"
$StatsFile = "mcp-server-stats.json"

# 检查 Node.js 是否可用
function Test-NodeJS {
    try {
        $null = Get-Command node -ErrorAction Stop
        return $true
    }
    catch {
        Write-Error "❌ 未找到 Node.js，请确保已安装 Node.js 并添加到 PATH"
        return $false
    }
}

# 检查服务器是否运行
function Test-ServerRunning {
    if (-not (Test-Path $PidFile)) {
        return @{ Running = $false }
    }

    try {
        $pid = Get-Content $PidFile -ErrorAction Stop
        $process = Get-Process -Id $pid -ErrorAction Stop
        return @{ Running = $true; PID = $pid; Process = $process }
    }
    catch {
        # 清理过期的 PID 文件
        if (Test-Path $PidFile) {
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        }
        return @{ Running = $false }
    }
}

# 启动服务器
function Start-MCPServer {
    $status = Test-ServerRunning
    if ($status.Running) {
        Write-Host "服务器已在运行中 (PID: $($status.PID))" -ForegroundColor Yellow
        return
    }

    Write-Host "🚀 启动 MCP 服务器..." -ForegroundColor Green
    
    # 构建启动参数
    $args = @(
        "packages\mcp-swagger-server\dist\index.js",
        "--transport", $Transport,
        "--port", $Port,
        "--endpoint", $Endpoint,
        "--managed",
        "--auto-restart",
        "--max-retries", $MaxRetries
    )
    
    Write-Host "📡 传输协议: $Transport" -ForegroundColor Cyan
    Write-Host "🔗 端口: $Port" -ForegroundColor Cyan
    Write-Host "📍 端点: $Endpoint" -ForegroundColor Cyan
    Write-Host "🔄 最大重试: $MaxRetries" -ForegroundColor Cyan
    
    try {
        if ($Daemon) {
            # 后台启动
            $process = Start-Process -FilePath "node" -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError $LogFile
            $process.Id | Out-File -FilePath $PidFile -Encoding utf8
            Write-Host "✅ 服务器已在后台启动 (PID: $($process.Id))" -ForegroundColor Green
        }
        else {
            # 前台启动
            Write-Host "✅ 服务器启动中，按 Ctrl+C 停止..." -ForegroundColor Green
            $process = Start-Process -FilePath "node" -ArgumentList $args -NoNewWindow -Wait -PassThru
        }
    }
    catch {
        Write-Error "❌ 启动失败: $_"
    }
}

# 停止服务器
function Stop-MCPServer {
    $status = Test-ServerRunning
    if (-not $status.Running) {
        Write-Host "服务器未运行" -ForegroundColor Yellow
        return
    }

    Write-Host "🛑 停止 MCP 服务器 (PID: $($status.PID))..." -ForegroundColor Yellow
    
    try {
        # 尝试优雅关闭
        Stop-Process -Id $status.PID -Force -ErrorAction Stop
        
        # 等待进程退出
        $attempts = 0
        $maxAttempts = 10
        while ($attempts -lt $maxAttempts) {
            Start-Sleep -Seconds 1
            $newStatus = Test-ServerRunning
            if (-not $newStatus.Running) {
                Write-Host "✅ 服务器已停止" -ForegroundColor Green
                return
            }
            $attempts++
        }
        
        Write-Host "⚠️ 强制终止服务器进程" -ForegroundColor Yellow
        Stop-Process -Id $status.PID -Force
        Write-Host "✅ 服务器已强制停止" -ForegroundColor Green
        
    }
    catch {
        Write-Error "❌ 停止失败: $_"
    }
    finally {
        # 清理 PID 文件
        if (Test-Path $PidFile) {
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        }
    }
}

# 重启服务器
function Restart-MCPServer {
    Write-Host "🔄 重启 MCP 服务器..." -ForegroundColor Cyan
    Stop-MCPServer
    Start-Sleep -Seconds 2
    Start-MCPServer
}

# 显示服务器状态
function Show-ServerStatus {
    $status = Test-ServerRunning
    
    Write-Host "📊 MCP 服务器状态:" -ForegroundColor Cyan
    
    if ($status.Running) {
        Write-Host "状态: 🟢 运行中" -ForegroundColor Green
        Write-Host "PID: $($status.PID)"
        
        if ($status.Process) {
            $cpu = $status.Process.CPU
            $memory = [math]::Round($status.Process.WorkingSet64 / 1MB, 2)
            $startTime = $status.Process.StartTime
            
            Write-Host "启动时间: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))"
            Write-Host "运行时长: $(((Get-Date) - $startTime).ToString('d\.hh\:mm\:ss'))"
            Write-Host "内存使用: $memory MB"
            if ($cpu) {
                Write-Host "CPU 时间: $([math]::Round($cpu, 2)) 秒"
            }
        }
        
        # 读取统计信息
        if (Test-Path $StatsFile) {
            try {
                $stats = Get-Content $StatsFile | ConvertFrom-Json
                Write-Host "重启次数: $($stats.restartCount)"
                if ($stats.lastRestartTime) {
                    $lastRestart = [DateTime]::Parse($stats.lastRestartTime)
                    Write-Host "最后重启: $($lastRestart.ToString('yyyy-MM-dd HH:mm:ss'))"
                    Write-Host "重启原因: $($stats.lastRestartReason)"
                }
            }
            catch {
                Write-Warning "无法读取统计信息"
            }
        }
    }
    else {
        Write-Host "状态: 🔴 已停止" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "配置信息:" -ForegroundColor Cyan
    Write-Host "传输协议: $Transport"
    Write-Host "端口: $Port"
    Write-Host "端点: $Endpoint"
    Write-Host "最大重试: $MaxRetries"
    Write-Host "内存限制: $MemoryLimit MB"
    Write-Host "日志级别: $LogLevel"
}

# 显示日志
function Show-ServerLogs {
    if (Test-Path $LogFile) {
        Write-Host "📝 服务器日志 (最后50行):" -ForegroundColor Cyan
        Write-Host ("-" * 80)
        Get-Content $LogFile -Tail 50
    }
    else {
        Write-Host "📝 日志文件不存在" -ForegroundColor Yellow
    }
}

# 主程序
function Main {
    if (-not (Test-NodeJS)) {
        exit 1
    }
    
    Write-Host "MCP Server Manager - 执行命令: $Command" -ForegroundColor Magenta
    
    switch ($Command) {
        "start" {
            Start-MCPServer
        }
        "stop" {
            Stop-MCPServer
        }
        "restart" {
            Restart-MCPServer
        }
        "status" {
            Show-ServerStatus
        }
        "logs" {
            Show-ServerLogs
        }
        default {
            Write-Error "❌ 未知命令: $Command"
            Write-Host "使用 -Help 查看可用命令"
            exit 1
        }
    }
}

# 执行主程序
Main
