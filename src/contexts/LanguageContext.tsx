
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language } from '@/types/index';
import { translations, propertyMap } from '@/config/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  tProp: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = React.useCallback((key: string, fallback?: string) => {
    const translationMap = translations[language];
    return translationMap[key as keyof typeof translationMap] || fallback || key;
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
