const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src/');
files.forEach(f => {
    const c = fs.readFileSync(f, 'utf8');
    if (c.includes('language ===') || c.includes('language ==')) {
        let hasLanguageDecl = false;
        const lines = c.split('\n');
        for (let l of lines) {
            if (l.match(/const\s+\{.*language.*\}\s*=\s*useLanguage/)) {
                hasLanguageDecl = true;
                break;
            }
        }
        if (!hasLanguageDecl) {
            console.log(f + ' is missing useLanguage declaration');
        }
    }
});
