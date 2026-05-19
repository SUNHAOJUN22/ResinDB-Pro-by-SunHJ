const fs = require('fs');

const newProducts = `    createProduct(321, 'mPE Exceed 1018', 'm-exxon', 'ExxonMobil Chemical', ['root_plastic','cat_pe','sub_mpe'], {
        '密度': { value: 0.918, unit: 'g/cm³', standard: 'ASTM D1505' },
        '熔体质量流动速率': { value: 1.0, unit: 'g/10min', temperature: '190°C/2.16kg', standard: 'ASTM D1238' },
        '拉伸屈服应力': { value: 15, unit: 'MPa', standard: 'ASTM D882' },
        '断裂伸长率': { value: 600, unit: '%', standard: 'ASTM D882' }
    }),
    createProduct(322, 'mPE Elite 5400G', 'm-dow', 'Dow', ['root_plastic','cat_pe','sub_mpe'], {
        '密度': { value: 0.916, unit: 'g/cm³', standard: 'ASTM D792' },
        '熔体质量流动速率': { value: 1.0, unit: 'g/10min', temperature: '190°C/2.16kg', standard: 'ASTM D1238' },
        '拉伸屈服应力': { value: 14, unit: 'MPa', standard: 'ASTM D882' },
        '断裂伸长率': { value: 650, unit: '%', standard: 'ASTM D882' }
    }),
    createProduct(323, 'SBR 1502', 'm-kumho', 'Kumho Polychem', ['root_rubber','cat_sbr'], {
        '门尼粘度': { value: 50, unit: 'MU', temperature: 'ML(1+4) 100°C', standard: 'ASTM D1646' },
        '挥发分': { value: 0.5, unit: '%', standard: 'ASTM D5668' },
        '灰分': { value: 0.3, unit: '%', standard: 'ASTM D5667' }
    }),
    createProduct(324, 'SBR 1712', 'm-lion', 'Lion Elastomers', ['root_rubber','cat_sbr'], {
        '门尼粘度': { value: 48, unit: 'MU', temperature: 'ML(1+4) 100°C', standard: 'ASTM D1646' },
        '挥发分': { value: 0.4, unit: '%', standard: 'ASTM D5668' },
        '灰分': { value: 0.2, unit: '%', standard: 'ASTM D5667' }
    }),
    createProduct(325, 'BR 9000', 'm-32', 'Sinopec Yangzi (扬子石化)', ['root_rubber','cat_br'], {
        '门尼粘度': { value: 45, unit: 'MU', temperature: 'ML(1+4) 100°C', standard: 'GB/T 1232.1' },
        '挥发分': { value: 0.5, unit: '%', standard: 'GB/T 24131' },
        '灰分': { value: 0.2, unit: '%', standard: 'GB/T 4498.1' }
    }),
    createProduct(326, 'BR CB24', 'm-arlanxeo', 'Arlanxeo', ['root_rubber','cat_br'], {
        '门尼粘度': { value: 44, unit: 'MU', temperature: 'ML(1+4) 100°C', standard: 'ASTM D1646' },
        '挥发分': { value: 0.4, unit: '%', standard: 'ASTM D5668' },
        '灰分': { value: 0.1, unit: '%', standard: 'ASTM D5667' }
    }),
    createProduct(327, 'IIR 1675N', 'm-exxon', 'ExxonMobil Chemical', ['root_rubber','cat_iir'], {
        '门尼粘度': { value: 51, unit: 'MU', temperature: 'ML(1+8) 125°C', standard: 'ASTM D1646' },
        '不饱和度': { value: 1.7, unit: 'mol%', standard: 'ExxonMobil Method' },
        '挥发分': { value: 0.3, unit: '%', standard: 'ASTM D5668' }
    }),
    createProduct(328, 'IIR 301', 'm-arlanxeo', 'Arlanxeo', ['root_rubber','cat_iir'], {
        '门尼粘度': { value: 51, unit: 'MU', temperature: 'ML(1+8) 125°C', standard: 'ASTM D1646' },
        '不饱和度': { value: 1.85, unit: 'mol%', standard: 'Arlanxeo Method' },
        '挥发分': { value: 0.3, unit: '%', standard: 'ASTM D5668' }
    })`;

const content = fs.readFileSync('constants.ts', 'utf8');
const updatedContent = content.replace(/\];\s*$/, ',\n' + newProducts + '\n];\n');
fs.writeFileSync('constants.ts', updatedContent);
console.log('Added missing products');
