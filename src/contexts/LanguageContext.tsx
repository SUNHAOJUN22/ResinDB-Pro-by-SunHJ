
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language } from '@/types/index';
import { translations, propertyMap } from '@/config/i18n';
import { safeStorage } from '@/lib/utils';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  tProp: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = safeStorage.local.getItem('resindb-language');
    return saved === 'en' || saved === 'zh' ? saved : 'zh';
  });

  React.useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    safeStorage.local.setItem('resindb-language', language);
  }, [language]);

  React.useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<Language>).detail;
      if (next === 'zh' || next === 'en') setLanguage(next);
    };
    window.addEventListener('resindb-language-change', handleLanguageChange);
    return () => window.removeEventListener('resindb-language-change', handleLanguageChange);
  }, []);

  const t = React.useCallback((key: string, fallback?: string) => {
    const translationMap = translations[language];
    const val = translationMap[key as keyof typeof translationMap];
    if (val !== undefined) return val;
    if (language === 'zh' && /[\u4e00-\u9fa5]/.test(key)) {
      return key;
    }
    return fallback || key;
  }, [language]);

  const tProp = React.useCallback((key: string) => {
    if (language === 'zh') return key;
    return propertyMap[key] || key;
  }, [language]);

  const toggleLanguage = React.useCallback(() => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  }, []);

  const value = React.useMemo(() => ({ language, setLanguage, toggleLanguage, t, tProp }), [language, toggleLanguage, t, tProp]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
