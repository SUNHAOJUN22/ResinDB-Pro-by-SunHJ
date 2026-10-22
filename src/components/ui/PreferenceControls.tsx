import React, { useMemo, useState } from 'react';
import { Globe2, Moon, Palette, Sun } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme, type ColorTheme } from '@/contexts/ThemeContext';

const paletteOptions = [
  ['indigo', 'Indigo', '靛蓝'],
  ['emerald', 'Emerald Bio', '翠绿'],
  ['rose', 'Rose', '玫红'],
  ['blue', 'Blue', '蓝色'],
  ['amber', 'Amber', '琥珀'],
  ['violet', 'Violet', '紫罗兰'],
  ['high-contrast', 'Contrast', '高对比度'],
] as const;

export const PreferenceControls: React.FC<{ placement?: 'floating' | 'inline' }> = ({ placement = 'floating' }) => {
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const labels = useMemo(
    () => ({
      language: language === 'zh' ? 'Switch to English / 切换至 English' : 'Switch to Chinese / 切换至中文',
      theme: language === 'zh' ? (theme === 'dark' ? '切换至浅色模式' : '切换至深色模式') : (theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'),
      palette: language === 'zh' ? '主题配色' : 'Color theme palette',
    }),
    [language, theme],
  );

  const choosePalette = (palette: ColorTheme) => {
    setColorTheme(palette);
    setPaletteOpen(false);
  };

  return (
    <div className={`${placement === 'floating' ? 'fixed right-3 top-3 z-[160]' : 'relative z-[110] shrink-0'} flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90`}>
      <button type="button" data-testid="language-control" onClick={toggleLanguage} title={labels.language} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        <Globe2 size={15} /> {language === 'zh' ? '中/EN' : 'EN/中'}
      </button>
      <button type="button" data-testid="theme-control" onClick={toggleTheme} title={labels.theme} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="relative">
        <button type="button" data-testid="palette-control" onClick={() => setPaletteOpen((open) => !open)} title={labels.palette} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <Palette size={16} />
        </button>
        {paletteOpen && (
          <div className="absolute right-0 top-10 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {paletteOptions.map(([id, englishName, chineseName]) => (
              <button key={id} type="button" data-palette={id} onClick={() => choosePalette(id)} className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${colorTheme === id ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                {language === 'zh' ? chineseName : englishName}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
