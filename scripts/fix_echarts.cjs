const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../components/charts');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Make sure we only fix where echarts.init is used
    if (content.includes('echarts.init(') && !content.includes('getInstanceByDom')) {
        // Find instance initialization
        content = content.replace(
            /(chartInstance\.current|instanceRef\.current)\s*=\s*echarts\.init\(chartRef\.current\);/g,
            '$1 = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);'
        );

        // Also if they have 'dark' theme init
        content = content.replace(
            /(chartInstance\.current|instanceRef\.current)\s*=\s*echarts\.init\(chartRef\.current,\s*(theme === 'dark' \? 'dark' : undefined)\);/g,
            '$1 = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current, $2);'
        );

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${file}`);
    }
}
