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
        }
    }
    return map;
}

const exportMap = buildExportMap(srcDir);

// Now read all files and replace broken "@/" path imports that no longer exist
function replaceBrokenImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Quick regex to find import statements
    const importRegex = /import\s+({[^}]*}|\*\s+as\s+[a-zA-Z0-9_]+|[a-zA-Z0-9_]+)\s+from\s+['"](@\/[^'"]+)['"]/g;
    
    let modified = content;
    modified = modified.replace(importRegex, (match, imports, modulePath) => {
        // Evaluate module path. Does it exist?
        const expectedRelPath = modulePath.substring(2); // remove @/
        const tsPath = path.join(srcDir, expectedRelPath + '.ts');
        const tsxPath = path.join(srcDir, expectedRelPath + '.tsx');
        const dtsPath = path.join(srcDir, expectedRelPath + '.d.ts');
        const indexPath = path.join(srcDir, expectedRelPath, 'index.ts');
        const indexTsxPath = path.join(srcDir, expectedRelPath, 'index.tsx');

        if (fs.existsSync(tsPath) || fs.existsSync(tsxPath) || fs.existsSync(dtsPath) || fs.existsSync(indexPath) || fs.existsSync(indexTsxPath)) {
            return match; // Path is correct
        }

        // It is broken. Let's find where the imported entities exist.
        if (imports.startsWith('{')) {
            const entities = imports.slice(1, -1).split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
            // Take the first entity's true path if we can find it
            for (const ent of entities) {
                if (exportMap[ent]) {
                    return `import ${imports} from "${exportMap[ent]}"`;
                }
            }
        } else {
             // Default import
             const ent = imports.trim();
             if (exportMap[ent]) {
                return `import ${imports} from "${exportMap[ent]}"`;
            }
        }
        
        return match;
    });

    if (modified !== content) {
        fs.writeFileSync(filePath, modified, 'utf-8');
        console.log(`Auto-corrected imports in ${path.relative(process.cwd(), filePath)}`);
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

