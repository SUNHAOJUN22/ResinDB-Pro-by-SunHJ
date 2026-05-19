const fs = require('fs');
let content = fs.readFileSync('src/components/layout/SystemNav.tsx', 'utf-8');

const devHtml = `
        <div className="relative group/dev mt-2 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-primary-500/50 hover:border-primary-500 overflow-hidden shadow-sm flex items-center justify-center cursor-help transition-colors">
             <img src={"data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='50' cy='50' r='8' fill='%234f46e5'/><ellipse cx='50' cy='50' rx='40' ry='12' stroke='%236366f1' stroke-width='2.5' transform='rotate(0 50 50)'/><ellipse cx='50' cy='50' rx='40' ry='12' stroke='%233b82f6' stroke-width='2.5' transform='rotate(60 50 50)'/><ellipse cx='50' cy='50' rx='40' ry='12' stroke='%238b5cf6' stroke-width='2.5' transform='rotate(120 50 50)'/><circle cx='90' cy='50' r='4' fill='%236366f1' /><circle cx='70' cy='84' r='4' fill='%233b82f6' /><circle cx='30' cy='16' r='4' fill='%238b5cf6' /></svg>"} alt="Developer haojunsun" className="w-full h-full object-cover" />
          </div>
          <div className="absolute left-[calc(100%+0.5rem)] bottom-0 px-3 py-1.5 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded shadow-lg opacity-0 invisible group-hover/dev:opacity-100 group-hover/dev:visible transition-all z-50 whitespace-nowrap pointer-events-none tracking-tight">
            <span className="opacity-70 font-mono text-[10px] mr-1 uppercase">Developer</span>
            <span className="text-primary-400 dark:text-primary-600">haojunsun</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
`;

content = content.replace(/<\/div>\s*<\/nav>\s*\);\s*};\s*$/, devHtml);
fs.writeFileSync('src/components/layout/SystemNav.tsx', content);
