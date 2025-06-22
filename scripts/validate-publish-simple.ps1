#!/usr/bin/env pwsh

# MCP Swagger Server Release Validation Script

Write-Host "MCP Swagger Server Release Validation" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$projectDir = "packages/mcp-swagger-server"
$packageJson = "$projectDir/package.json"
$distDir = "$projectDir/dist"
$cliFile = "$distDir/cli.js"

# Check project structure
Write-Host "`nChecking project structure..." -ForegroundColor Yellow

if (!(Test-Path $packageJson)) {
    Write-Host "ERROR: package.json not found" -ForegroundColor Red
    exit 1
}
Write-Host "OK: package.json exists" -ForegroundColor Green

if (!(Test-Path $distDir)) {
    Write-Host "ERROR: dist directory not found, please run 'pnpm run build'" -ForegroundColor Red
    exit 1
}
Write-Host "OK: dist directory exists" -ForegroundColor Green

# Check package.json configuration
Write-Host "`nChecking package.json configuration..." -ForegroundColor Yellow

$packageContent = Get-Content $packageJson | ConvertFrom-Json

if (!$packageContent.bin) {
    Write-Host "ERROR: package.json missing bin field" -ForegroundColor Red
    exit 1
}
Write-Host "OK: bin field configured" -ForegroundColor Green

# Check CLI file
Write-Host "`nChecking CLI file..." -ForegroundColor Yellow

if (!(Test-Path $cliFile)) {
    Write-Host "ERROR: CLI file not found: $cliFile" -ForegroundColor Red
    exit 1
}

$firstLine = Get-Content $cliFile -First 1
if ($firstLine -ne "#!/usr/bin/env node") {
    Write-Host "ERROR: CLI file missing correct shebang" -ForegroundColor Red
    exit 1
}
Write-Host "OK: CLI file shebang correct" -ForegroundColor Green

# Test CLI functionality
Write-Host "`nTesting CLI functionality..." -ForegroundColor Yellow

try {
    $output = & node $cliFile --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: CLI --help command works" -ForegroundColor Green
    } else {
        Write-Host "ERROR: CLI --help command failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: CLI test failed: $_" -ForegroundColor Red
    exit 1
}

# Check required files
Write-Host "`nChecking required files..." -ForegroundColor Yellow

$requiredFiles = @("README.md", "LICENSE", "ARCHITECTURE.md")
foreach ($file in $requiredFiles) {
    $filePath = "$projectDir/$file"
    if (Test-Path $filePath) {
        Write-Host "OK: $file exists" -ForegroundColor Green
    } else {
        Write-Host "WARNING: $file missing" -ForegroundColor Yellow
    }
}

# Create test package
Write-Host "`nCreating test package..." -ForegroundColor Yellow

Push-Location $projectDir
try {
    $packOutput = npm pack 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: Test package created successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Test package creation failed" -ForegroundColor Red
    }
} finally {
    Pop-Location
}

Write-Host "`nValidation complete! Project is ready for NPM publication." -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. npm login" -ForegroundColor White
Write-Host "2. npm publish --tag beta (for testing)" -ForegroundColor White
Write-Host "3. npm publish (for production)" -ForegroundColor White
