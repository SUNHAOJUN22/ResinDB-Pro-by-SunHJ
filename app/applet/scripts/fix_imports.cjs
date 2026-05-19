const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'src');

function resolveImportPath(currentFilePath, importString) {
    if (!importString.startsWith('.')) return importString;
    const currentDir = path.dirname(currentFilePath);
    const absoluteImportPath = path.resolve(currentDir, importString);
    const relativeToSrc = path.relative(srcDir, absoluteImportPath);
    let newImportPath = '@/' + relativeToSrc.replace(/\\/g, '/');
    if (newImportPath.endsWith('/')) {
        newImportPath = newImportPath.slice(0, -1);
    }
    return newImportPath;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /(import\s+.*?from\s+['"])(.*?)(['"])/g;
    const exportRegex = /(export\s+.*?from\s+['"])(.*?)(['"])/g;
    const dynamicImportRegex = /(import\(['"])(.*?)(['"]\))/g;

    let modified = content;
    modified = modified.replace(importRegex, (match, p1, p2, p3) => {
        return p1 + resolveImportPath(filePath, p2) + p3;
    });
    modified = modified.replace(exportRegex, (match, p1, p2, p3) => {
        return p1 + resolveImportPath(filePath, p2) + p3;
    });
    modified = modified.replace(dynamicImportRegex, (match, p1, p2, p3) => {
        return p1 + resolveImportPath(filePath, p2) + p3;
    });

    if (modified !== content) {
        fs.writeFileSync(filePath, modified, 'utf-8');
        console.log(`Updated imports in ${path.relative(process.cwd(), filePath)}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

walkDir(srcDir);
