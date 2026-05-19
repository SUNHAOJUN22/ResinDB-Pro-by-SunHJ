const fs = require('fs');
const content = fs.readFileSync('constants.ts', 'utf8');

const categoryIds = [...content.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);

const catalogMatch = content.match(/export const PRODUCT_CATALOG: Product\[\] = \[([\s\S]*?)\];/);
if (!catalogMatch) {
    console.log("Could not find PRODUCT_CATALOG");
    process.exit(1);
}
const catalogStr = catalogMatch[1];

const allProductCats = new Set();
const productLines = catalogStr.split('createProduct');
productLines.forEach(line => {
    const match = line.match(/\[(.*?)\]/);
    if (match) {
        const cats = match[1].split(',').map(s => s.trim().replace(/'/g, ''));
        cats.forEach(c => allProductCats.add(c));
    }
});

const emptyCategories = categoryIds.filter(id => !id.startsWith('m-') && !allProductCats.has(id));
console.log("Empty categories:", emptyCategories);
