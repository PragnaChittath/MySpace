import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LanguageInfo, getLanguageInfo } from './languages.js';

import en from '../locales/en.json';
import te from '../locales/te.json';
import hi from '../locales/hi.json';
import ta from '../locales/ta.json';
import kn from '../locales/kn.json';
import ml from '../locales/ml.json';
import bn from '../locales/bn.json';
import mr from '../locales/mr.json';
import gu from '../locales/gu.json';
import pa from '../locales/pa.json';
import ur from '../locales/ur.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import ar from '../locales/ar.json';

const LOCALES: Record<string, Record<string, any>> = {
  en,
  te,
  hi,
  ta,
  kn,
  ml,
  bn,
  mr,
  gu,
  pa,
  ur,
  es,
  fr,
  de,
  ja,
  zh,
  ar
};

const STORAGE_KEY = 'myspace_vault_language';

interface LanguageContextType {
  currentLanguage: LanguageInfo;
  languageCode: string;
  setLanguage: (code: string) => void;
  t: (keyPath: string, defaultText?: string) => string;
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
  supportedLanguages: LanguageInfo[];
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper to look up nested key "nav.mySpace"
function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return typeof curr === 'string' ? curr : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageCode, setLanguageCodeState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
          return saved;
        }
      } catch (e) {
        console.warn('Could not read saved language from storage', e);
      }
    }
    return DEFAULT_LANGUAGE;
  });

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const currentLanguage = useMemo(() => {
    return getLanguageInfo(languageCode);
  }, [languageCode]);

  const isRtl = currentLanguage.direction === 'rtl';

  const setLanguage = (newCode: string) => {
    const valid = SUPPORTED_LANGUAGES.some(l => l.code === newCode);
    const targetCode = valid ? newCode : DEFAULT_LANGUAGE;
    setLanguageCodeState(targetCode);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, targetCode);
        // Set document direction for RTL languages
        const info = getLanguageInfo(targetCode);
        document.documentElement.dir = info.direction || 'ltr';
        document.documentElement.lang = targetCode;
      } catch (e) {
        console.warn('Could not persist language to storage', e);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const info = getLanguageInfo(languageCode);
      document.documentElement.dir = info.direction || 'ltr';
      document.documentElement.lang = languageCode;
    }
  }, [languageCode]);

  const t = (keyPath: string, defaultText?: string): string => {
    const activeLocale = LOCALES[languageCode];
    if (activeLocale) {
      const val = getNestedValue(activeLocale, keyPath);
      if (val) return val;
    }

    // Fallback to English
    const fallbackVal = getNestedValue(LOCALES['en'], keyPath);
    if (fallbackVal) return fallbackVal;

    // Fallback to provided default text or key path
    return defaultText || keyPath.split('.').pop() || keyPath;
  };

  const openLanguageModal = () => setIsLanguageModalOpen(true);
  const closeLanguageModal = () => setIsLanguageModalOpen(false);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        languageCode,
        setLanguage,
        t,
        isLanguageModalOpen,
        openLanguageModal,
        closeLanguageModal,
        supportedLanguages: SUPPORTED_LANGUAGES,
        isRtl
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
