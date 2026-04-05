import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ru } from '../locales/ru';
import { kz } from '../locales/kz';

export type Language = 'ru' | 'kz';

// Minimal nested key type resolving logic implementation
type Dictionary = Record<string, any>;

const dictionaries: Record<Language, Dictionary> = {
    ru,
    kz,
};

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('ru');

    useEffect(() => {
        const savedLang = localStorage.getItem('appLang') as Language;
        if (savedLang && ['ru', 'kz'].includes(savedLang)) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('appLang', lang);
    };

    const t = (key: string, ObjectReplacements?: Record<string, string | number>): string => {
        const dict = dictionaries[language] || dictionaries['ru']; // fallback to ru
        const keys = key.split('.');

        let val: any = dict;
        for (const k of keys) {
            if (val === undefined || val === null) break;
            val = val[k];
        }

        if (typeof val !== 'string') {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }

        let result = val;
        if (ObjectReplacements) {
            Object.keys(ObjectReplacements).forEach(k => {
                const searchParam = new RegExp(`{{${k}}}`, 'g');
                result = result.replace(searchParam, String(ObjectReplacements[k]));
            });
        }
        return result;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
};
