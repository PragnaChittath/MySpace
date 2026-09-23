import React, { useState, useMemo } from 'react';
import { Globe, Search, Check, X, Sparkles } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';
import { LanguageInfo } from '../i18n/languages.js';

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLanguageSelected?: (lang: LanguageInfo) => void;
}

export function LanguageSelectorModal({
  isOpen,
  onClose,
  onLanguageSelected
}: LanguageSelectorModalProps) {
  const { currentLanguage, setLanguage, supportedLanguages, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'Indian' | 'International'>('ALL');

  const filteredLanguages = useMemo(() => {
    return supportedLanguages.filter(lang => {
      // Region filter
      if (activeFilter !== 'ALL' && lang.region !== activeFilter) {
        return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
      );
    });
  }, [supportedLanguages, activeFilter, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (lang: LanguageInfo) => {
    setLanguage(lang.code);
    if (onLanguageSelected) {
      onLanguageSelected(lang);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="language-modal-title"
                className="text-lg font-bold text-white tracking-tight flex items-center gap-2"
              >
                <span>{t('languageModal.title', 'Select Display Language')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  {currentLanguage.nativeName}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'languageModal.subtitle',
                  'Choose your preferred language for the interface. You can input text and search in any language.'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Region Filter Bar */}
        <div className="p-4 sm:px-6 bg-slate-950/40 border-b border-slate-800/80 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t(
                'languageModal.searchPlaceholder',
                'Search languages by name, script, or region...'
              )}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('languageModal.all', 'All Languages')} ({supportedLanguages.length})
            </button>
            <button
              onClick={() => setActiveFilter('Indian')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                activeFilter === 'Indian'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🇮🇳 {t('languageModal.indian', 'Indian Languages')} (23)
            </button>
            <button
              onClick={() => setActiveFilter('International')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                activeFilter === 'International'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🌐 {t('languageModal.international', 'International')} (19)
            </button>
          </div>
        </div>

        {/* Scrollable Language Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredLanguages.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Globe className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-medium text-slate-300">No languages found</div>
              <p className="text-xs text-slate-500">
                No supported language matches "{searchQuery}". Try another keyword.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredLanguages.map(lang => {
                const isSelected = currentLanguage.code === lang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang)}
                    className={`group relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-950/30 ring-1 ring-blue-500/50'
                        : 'bg-slate-850/60 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                          {lang.nativeName}
                        </span>
                        {lang.direction === 'rtl' && (
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            RTL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400 truncate">{lang.name}</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                          {lang.code}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700 group-hover:border-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              All 23 Indian languages + 19 global languages supported for search & input
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
