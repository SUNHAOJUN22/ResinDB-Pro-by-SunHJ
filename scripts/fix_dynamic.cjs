const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(process.cwd(), 'src');

function buildExportMap(dir, map = {}) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            buildExportMap(fullPath, map);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const exportMatches = [...content.matchAll(/export\s+(?:const|function|class|type|interface)\s+([A-Za-z0-9_]+)/g)];
            const defaultExportMatch = content.match(/export\s+default\s+([A-Za-z0-9_]+)/);
            
            const relPathStr = path.relative(srcDir, fullPath).replace(/\\/g, '/');
            const aliasPath = '@/' + relPathStr.replace(/\.tsx?$/, '');

            for (const m of exportMatches) {
                map[m[1]] = aliasPath;
            }
            if (defaultExportMatch) {
                map[defaultExportMatch[1]] = aliasPath;
            }
            // For lazy import guessing context
            const fileNameWithoutExt = path.basename(file, path.extname(file));
            map['__lazy__' + fileNameWithoutExt] = aliasPath;
        }
    }
    return map;
}

const exportMap = buildExportMap(srcDir);

function replaceBrokenImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Quick regex to find dynamic imports: import("@/...")
    const dynamicImportRegex = /import\s*\(\s*['"](@\/[^'"]+)['"]\s*\)/g;
    
    let modified = content;
    modified = modified.replace(dynamicImportRegex, (match, modulePath) => {
        const expectedRelPath = modulePath.substring(2);
        const fileBase = path.basename(expectedRelPath);

        const tsPath = path.join(srcDir, expectedRelPath + '.ts');
        const tsxPath = path.join(srcDir, expectedRelPath + '.tsx');
        if (fs.existsSync(tsPath) || fs.existsSync(tsxPath)) {
            return match; // Path is correct
        }

        // Broken!
        if (exportMap['__lazy__' + fileBase]) {
            return `import("${exportMap['__lazy__' + fileBase]}")`;
        }
        return match;
    });

    if (modified !== content) {
        fs.writeFileSync(filePath, modified, 'utf-8');
        console.log(`Auto-corrected dynamic imports in ${path.relative(process.cwd(), filePath)}`);
    }
}

function processAll(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processAll(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            replaceBrokenImports(fullPath);
        }
    }
}

processAll(srcDir);
