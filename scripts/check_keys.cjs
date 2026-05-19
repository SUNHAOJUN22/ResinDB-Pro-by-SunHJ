const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '../components');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(componentsDir);
let missingKeys = 0;

files.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (line.includes('.map(') && line.includes('=>') && (line.includes('<') || lines[i+1]?.includes('<'))) {
            // Check current and next 2 lines for key=
            const chunk = lines.slice(i, i+3).join(' ');
            // If it starts a jsx tag but without key=
            // simple heuristic:
            if (chunk.includes('<') && !chunk.includes('key=')) {
                // Ignore cases where it returns a string like in ECharts text
                if (!chunk.includes('`<') && !chunk.includes('return `<') && !chunk.includes('/><')) {
                   console.log(`${file}:${i+1} -> ${line.trim()}`);
                   missingKeys++;
                }
            }
        }
    });
});
console.log(`Found ${missingKeys} missing keys.`);
