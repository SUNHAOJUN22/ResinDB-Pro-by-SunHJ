#!/bin/bash
set -e

echo "====================================="
echo "       QUALITY GATE INITIATED        "
echo "====================================="

echo "[1/4] Checking environment..."
node -v
npm -v

echo "[2/4] Linting & Typechecking..."
npm run lint
npm run typecheck

echo "[3/4] Running tests..."
npm run test:unit -- --passWithNoTests
npm run test:science -- --passWithNoTests

echo "====================================="
echo "       QUALITY GATE PASSED           "
echo "====================================="
