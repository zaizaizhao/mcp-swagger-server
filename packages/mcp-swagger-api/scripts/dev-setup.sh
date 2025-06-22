#!/usr/bin/env bash

# MCP Swagger API Development Script
# This script helps set up and run the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

print_header() {
    print_color $BLUE "=================================="
    print_color $BLUE "   MCP Swagger API Development"
    print_color $BLUE "=================================="
}

print_section() {
    print_color $YELLOW "\n📦 $1"
    print_color $YELLOW "================================"
}

print_success() {
    print_color $GREEN "✅ $1"
}

print_error() {
    print_color $RED "❌ $1"
}

print_info() {
    print_color $BLUE "ℹ️  $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_header

# Install dependencies
print_section "Installing Dependencies"
if command -v pnpm >/dev/null 2>&1; then
    print_info "Using pnpm for package management"
    pnpm install
else
    print_info "Using npm for package management"
    npm install
fi
print_success "Dependencies installed"

# Build the project
print_section "Building Project"
if command -v pnpm >/dev/null 2>&1; then
    pnpm run build
else
    npm run build
fi
print_success "Project built successfully"

# Run linting
print_section "Running Linter"
if command -v pnpm >/dev/null 2>&1; then
    pnpm run lint
else
    npm run lint
fi
print_success "Linting completed"

# Run tests
print_section "Running Tests"
if command -v pnpm >/dev/null 2>&1; then
    pnpm run test
else
    npm run test
fi
print_success "Tests completed"

print_section "Development Environment Ready"
print_success "All setup steps completed successfully!"
print_info "You can now run the following commands:"
print_info "  • Development server: npm run start:dev"
print_info "  • Production build: npm run build"
print_info "  • Run tests: npm run test"
print_info "  • View API docs: http://localhost:3001/api"
