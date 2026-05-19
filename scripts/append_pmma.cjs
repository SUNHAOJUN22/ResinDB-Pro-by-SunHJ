const fs = require('fs');

const newProducts = `    createProduct(329, 'PMMA CM205', 'm-chimei', 'Chi Mei', ['root_plastic','cat_pmma'], {
        '密度': { value: 1.19, unit: 'g/cm³', standard: 'ISO 1183' },
        '熔体质量流动速率': { value: 1.8, unit: 'g/10min', temperature: '230°C/3.8kg', standard: 'ISO 1133' },
        '透光率': { value: 92, unit: '%', standard: 'ISO 13468' }
    })`;

const content = fs.readFileSync('constants.ts', 'utf8');
const updatedContent = content.replace(/\];\s*$/, ',\n' + newProducts + '\n];\n');
fs.writeFileSync('constants.ts', updatedContent);
console.log('Added PMMA product');
