#!/bin/bash
set -e

echo "Running Continuous Improvement Script..."
echo "Scanning for TODO/FIXME..."
grep -r "TODO\|FIXME" . || echo "No TODOs found!"

echo "Running tests to report coverage..."
npm run test:coverage -- --passWithNoTests

echo "Detailed continuous improvement tasks completed."
