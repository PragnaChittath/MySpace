import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  AlertTriangle,
  HardDrive,
  Search,
  Filter,
  Eye,
  EyeOff,
  MoreVertical,
  Trash2,
  Lock,
  Calendar,
  Tag,
  CheckCircle2,
  FileText,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  ScanFace,
  Mic,
  FileAudio,
  Play,
  Edit3,
  ArrowUpRight,
  Share2,
  Download,
  FileArchive,
  Plus,
  ChevronDown,
  Users
} from 'lucide-react';
import { VaultDocument, DocumentCategory, SensitivityLevel, User } from '../types.js';
import {
  formatBytes,
  formatDate,
  getExpiryStatus,
  getCategoryBadge,
  getSensitivityBadge,
  formatAudioDuration,
  isAudioFile
} from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';

interface DashboardViewProps {
  currentUser: User | null;
  documents: VaultDocument[];
  onViewDocument: (doc: VaultDocument) => void;
  onEditDocument?: (doc: VaultDocument) => void;
  onPlayAudio?: (doc: VaultDocument) => void;
  onGenerateQr: (doc: VaultDocument) => void;
  onShareDirect?: (doc: VaultDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onHideDocument?: (doc: VaultDocument) => void;
  onRefresh: () => void;
  onOpenUpload?: () => void;
  onOpenBulkExport?: () => void;
  onShareGeneral?: (mode: 'DIRECT' | 'QR') => void;
  onOpenSecuritySettings?: () => void;
  onOpenMultiProfiles?: () => void;
  isLoading: boolean;
}

const CATEGORIES: { id: 'ALL' | DocumentCategory; label: string }[] = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'VOICE_AUDIO', label: '🎙️ Voice & Audio' },
  { id: 'IDENTITY', label: 'Identity & IDs' },
  { id: 'EDUCATION', label: 'Education & Marksheets' },
  { id: 'EMPLOYMENT', label: 'Career & Internships' },
  { id: 'MEDICAL', label: 'Medical & Health' },
  { id: 'FINANCIAL', label: 'PAN & Financial' },
  { id: 'LEGAL', label: 'Legal & Certificates' },
  { id: 'OTHER', label: 'Other' }
];

export function DashboardView({
  currentUser,
  documents,
  onViewDocument,
  onEditDocument,
  onPlayAudio,
  onGenerateQr,
  onShareDirect,
  onDeleteDocument,
  onHideDocument,
  onRefresh,
  onOpenUpload,
  onOpenBulkExport,
  onShareGeneral,
  onOpenSecuritySettings,
  onOpenMultiProfiles,
  isLoading
}: DashboardViewProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | DocumentCategory>('ALL');
  const [selectedSensitivity, setSelectedSensitivity] = useState<'ALL' | SensitivityLevel>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'expiry' | 'title' | 'size'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categoriesList = [
    { id: 'ALL' as const, label: t('dashboard.categories.all', 'All Documents') },
    { id: 'VOICE_AUDIO' as const, label: t('dashboard.categories.voiceAudio', '🎙️ Voice & Audio') },
    { id: 'IDENTITY' as const, label: t('dashboard.categories.identity', 'Identity & IDs') },
    { id: 'EDUCATION' as const, label: t('dashboard.categories.education', 'Education & Marksheets') },
    { id: 'EMPLOYMENT' as const, label: t('dashboard.categories.employment', 'Career & Internships') },
    { id: 'MEDICAL' as const, label: t('dashboard.categories.medical', 'Medical & Health') },
    { id: 'FINANCIAL' as const, label: t('dashboard.categories.financial', 'PAN & Financial') },
    { id: 'LEGAL' as const, label: t('dashboard.categories.legal', 'Legal & Certificates') },
    { id: 'OTHER' as const, label: t('dashboard.categories.other', 'Other') }
  ];

  // Hide & Menu state
  const [confirmHideDoc, setConfirmHideDoc] = useState<VaultDocument | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCardTouchStart = (doc: VaultDocument) => {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      setConfirmHideDoc(doc);
      longPressTimerRef.current = null;
    }, 600);
  };

  const handleCardTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.doc-menu-container')) {
        setActiveMenuDocId(null);
      }
      if (!target.closest('#header-share-container')) {
        setShowShareMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Metrics computation
  const safeDocs = Array.isArray(documents) ? documents.filter(Boolean) : [];
  const totalDocs = safeDocs.length;
  const activeQrCount = safeDocs.reduce((acc, d) => acc + (d?.shareCount || 0), 0);
  const totalStorage = safeDocs.reduce((acc, d) => acc + (d?.fileSize || 0), 0);

  const expiringDocs = safeDocs.filter(d => {
    if (!d || !d.expiryDate) return false;
    const st = getExpiryStatus(d.expiryDate);
    return st.status === 'EXPIRING_SOON' || st.status === 'EXPIRED';
  });

  // Filter and sort documents with Unicode NFC normalization (multilingual search)
  const filteredDocs = safeDocs
    .filter(doc => {
      if (!doc) return false;
      const q = searchQuery.toLowerCase().trim().normalize('NFC');
      const matchesSearch =
        !q ||
        (doc.title && doc.title.toLowerCase().normalize('NFC').includes(q)) ||
        (doc.documentNumber && doc.documentNumber.toLowerCase().normalize('NFC').includes(q)) ||
        (doc.tags && doc.tags.some(t => t && t.toLowerCase().normalize('NFC').includes(q))) ||
        (doc.notes && doc.notes.toLowerCase().normalize('NFC').includes(q)) ||
        (doc.category && doc.category.toLowerCase().normalize('NFC').includes(q)) ||
        (doc.verifiedIssuer && doc.verifiedIssuer.toLowerCase().normalize('NFC').includes(q));

      const matchesCat = selectedCategory === 'ALL' || doc.category === selectedCategory;
      const matchesSens = selectedSensitivity === 'ALL' || doc.sensitivity === selectedSensitivity;

      return matchesSearch && matchesCat && matchesSens;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'expiry') {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'size') {
        return (b.fileSize || 0) - (a.fileSize || 0);
      }
      return 0;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">SECURE VAULT</span>
            {currentUser?.relationship && !currentUser.relationship.includes('Primary') && currentUser.relationship !== 'Self' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {currentUser.relationship}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {t('dashboard.welcome', 'Welcome')}, {currentUser?.name || 'User'}
            </h1>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 self-start sm:self-center">
          {/* UPLOAD NEW button placed next to Refresh near Welcome User area */}
          {onOpenUpload && (
            <button
              id="btn-upload-new-main"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap"
              title="Upload New (Upload from Device, Take Photo/Video, Voice Input, Paste)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="tracking-wide">UPLOAD NEW</span>
            </button>
          )}

          {/* Small compact EXPORT button */}
          {onOpenBulkExport && (
            <button
              id="btn-header-export"
              onClick={onOpenBulkExport}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              title="Export all documents & files to device (.zip)"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>EXPORT</span>
            </button>
          )}

          {/* Small compact SHARE button with Direct Share and Share via QR options */}
          <div id="header-share-container" className="relative">
            <button
              id="btn-header-share"
              onClick={() => setShowShareMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              title="Share documents securely"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span>SHARE</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showShareMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setShowShareMenu(false);
                    if (onShareGeneral) {
                      onShareGeneral('DIRECT');
                    } else if (documents.length > 0 && onShareDirect) {
                      onShareDirect(documents[0]);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
                  <span>Direct Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowShareMenu(false);
                    if (onShareGeneral) {
                      onShareGeneral('QR');
                    } else if (documents.length > 0) {
                      onGenerateQr(documents[0]);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <QrCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Share via QR</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Vault State"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expiry Warning Banner (If documents are expiring soon) */}
      {expiringDocs.length > 0 && (
        <div className="rounded-2xl bg-amber-950/30 border border-amber-500/30 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-200">
              Document Expiry Notice ({expiringDocs.length} Action Required)
            </h3>
            <p className="text-xs text-amber-300/80 mt-0.5">
              The following vault items require your attention for renewal or re-verification:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {expiringDocs.map(doc => {
                const exp = getExpiryStatus(doc.expiryDate);
                return (
                  <button
                    key={doc.id}
                    onClick={() => onViewDocument(doc)}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-900/40 hover:bg-amber-800/60 border border-amber-600/40 text-xs font-medium text-amber-100 transition-colors cursor-pointer"
                  >
                    <span>{doc.title}</span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-semibold ${exp.colorClass}`}>
                      {exp.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top 4 Metric Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalDocs}</div>
            <div className="text-xs text-slate-500">{t('dashboard.securedDocuments', 'Secured Documents')}</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{activeQrCount}</div>
            <div className="text-xs text-slate-500">{t('dashboard.activeQrShares', 'Active QR Shares')}</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{expiringDocs.length}</div>
            <div className="text-xs text-slate-500">{t('dashboard.expiringRenewals', 'Expiring / Renewals')}</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{formatBytes(totalStorage)}</div>
            <div className="text-xs text-slate-400">{t('dashboard.storageUsed', 'Storage Used • Unlimited')}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Documents (Col 8) + Sidebar Widgets (Col 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Documents & Controls */}
        <div className="lg:col-span-8 space-y-5">
          {/* Search, Sort & View Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-vault-search"
                  type="text"
                  placeholder={t('dashboard.searchPlaceholder', 'Search documents, numbers, categories, tags, or notes...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Sort & View Mode */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="recent">{t('dashboard.sortRecent', 'Recently Added')}</option>
                  <option value="expiry">{t('dashboard.sortExpiry', 'Expiry Date')}</option>
                  <option value="title">{t('dashboard.sortTitle', 'Document Title')}</option>
                  <option value="size">{t('dashboard.sortSize', 'File Size')}</option>
                </select>

                <select
                  value={selectedSensitivity}
                  onChange={e => setSelectedSensitivity(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">All Sensitivity</option>
                  <option value="STANDARD">Standard</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="RESTRICTED">Restricted</option>
                  <option value="TOP_SECRET">Top Secret</option>
                </select>

                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Grid View"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="List View"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categoriesList.map(cat => {
                const count =
                  cat.id === 'ALL'
                    ? documents.length
                    : documents.filter(d => d.category === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedCategory === cat.id ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Documents Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-white">Recent Documents</h2>
            <span className="text-xs text-slate-500">{filteredDocs.length} item(s)</span>
          </div>

          {/* Document Grid / List */}
          {filteredDocs.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                <Lock className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-white">
                {documents.length === 0
                  ? `${currentUser?.name || 'User'}'s Vault is Empty`
                  : 'No documents match your query'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                {documents.length === 0
                  ? `Every person has an isolated, private vault. Upload files, capture camera photos/videos, record voice notes, or paste records to store them safely under ${currentUser?.name || 'this profile'}.`
                  : 'Try adjusting your search keywords or clear the category filters.'}
              </p>
              {documents.length === 0 && onOpenUpload && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={onOpenUpload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Upload First Record for {currentUser?.name?.split(' ')[0] || 'User'}</span>
                  </button>
                </div>
              )}
              {documents.length > 0 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                      setSelectedSensitivity('ALL');
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredDocs.map(doc => {
                const catBadge = getCategoryBadge(doc.category);
                const expBadge = getExpiryStatus(doc.expiryDate);
                const ext = doc.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                const isAudio = isAudioFile(doc.fileType, doc.fileName, doc.category);
                const isPdf = ext === 'PDF';
                const isImg = ext === 'JPG' || ext === 'PNG' || ext === 'JPEG';

                return (
                  <div
                    key={doc.id}
                    onTouchStart={() => handleCardTouchStart(doc)}
                    onTouchEnd={handleCardTouchEnd}
                    onTouchMove={handleCardTouchEnd}
                    className="group flex flex-col justify-between rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 transition-all p-5 text-slate-300 relative"
                  >
                    <div>
                      {/* Top row: Format Pill + Expiry Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] ${
                              isAudio
                                ? 'bg-violet-900/30 text-violet-300 border border-violet-500/30'
                                : isPdf
                                ? 'bg-red-900/20 text-red-400 border border-red-500/20'
                                : isImg
                                ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isAudio ? '🎙️' : ext.slice(0, 3)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${catBadge.colorClass}`}>
                            {catBadge.label.split(' ')[0]}
                          </span>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${expBadge.colorClass}`}>
                          {expBadge.label}
                        </span>
                      </div>

                      {/* Document Title & Number */}
                      <h3
                        onClick={() => (isAudio && onPlayAudio ? onPlayAudio(doc) : onViewDocument(doc))}
                        className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors line-clamp-1 cursor-pointer flex items-center gap-1.5"
                      >
                        {isAudio && <FileAudio className="w-4 h-4 text-violet-400 shrink-0" />}
                        <span>{doc.title}</span>
                      </h3>

                      <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                        <span>
                          Encrypted • {formatBytes(doc.fileSize)}
                          {doc.audioDurationSeconds ? ` • ⏱️ ${formatAudioDuration(doc.audioDurationSeconds)}` : ''}
                          {doc.documentNumber ? ` • ID: ${doc.documentNumber}` : ''}
                        </span>
                      </div>

                      {/* Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {doc.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Issuer */}
                      {doc.verifiedIssuer && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{doc.verifiedIssuer}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isAudio && onPlayAudio ? (
                          <button
                            onClick={() => onPlayAudio(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-bold border border-violet-500/30 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-violet-300" />
                            <span>Play Audio</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onViewDocument(doc)}
                            className="text-xs text-blue-500 hover:text-blue-400 font-medium cursor-pointer"
                          >
                            View Details
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Direct Hide Button */}
                        {onHideDocument && (
                          <button
                            onClick={() => setConfirmHideDoc(doc)}
                            className="p-1.5 rounded-md bg-slate-800/80 hover:bg-indigo-950 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                            title="🔒 Hide (Move to private Hidden Space)"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onEditDocument && (
                          <button
                            onClick={() => onEditDocument(doc)}
                            className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Rename / Re-categorize Document"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onShareDirect && (
                          <button
                            onClick={() => onShareDirect(doc)}
                            className="p-1.5 rounded-md bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 hover:text-white transition-colors cursor-pointer"
                            title="↗ Share Directly (Temporary Secure Link)"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onGenerateQr(doc)}
                          className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="▣ Share via QR (Encrypted QR Code)"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {/* Three-dot dropdown menu */}
                        <div className="relative doc-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                            }}
                            className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="More options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeMenuDocId === doc.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                              {onHideDocument && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    setConfirmHideDoc(doc);
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                                >
                                  <EyeOff className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span>🔒 Hide Item</span>
                                </button>
                              )}
                              {onShareDirect && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    onShareDirect(doc);
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-teal-300 hover:bg-teal-950/60 rounded-lg transition-colors cursor-pointer"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                  <span>↗ Share Directly</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(null);
                                  onGenerateQr(doc);
                                }}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>▣ Share via QR</span>
                              </button>
                              {onEditDocument && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuDocId(null);
                                    onEditDocument(doc);
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>Edit Metadata</span>
                                </button>
                              )}
                              <div className="h-px bg-slate-800 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(null);
                                  if (confirm(`Delete "${doc.title}"?`)) onDeleteDocument(doc.id);
                                }}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Delete Item</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Clean Table List View */
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800/30 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Category</th>
                    <th className="px-6 py-3 font-semibold">Expiry</th>
                    <th className="px-6 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-800">
                  {filteredDocs.map(doc => {
                    const ext = doc.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                    const isAudio = isAudioFile(doc.fileType, doc.fileName, doc.category);
                    const isPdf = ext === 'PDF';
                    const isImg = ext === 'JPG' || ext === 'PNG' || ext === 'JPEG';
                    const catBadge = getCategoryBadge(doc.category);
                    const expBadge = getExpiryStatus(doc.expiryDate);

                    return (
                      <tr
                        key={doc.id}
                        onTouchStart={() => handleCardTouchStart(doc)}
                        onTouchEnd={handleCardTouchEnd}
                        onTouchMove={handleCardTouchEnd}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-6 py-4 flex items-center">
                          <span
                            className={`w-8 h-8 rounded flex items-center justify-center mr-3 font-bold text-[10px] ${
                              isAudio
                                ? 'bg-violet-900/30 text-violet-300 border border-violet-500/30'
                                : isPdf
                                ? 'bg-red-900/20 text-red-500'
                                : isImg
                                ? 'bg-blue-900/20 text-blue-500'
                                : 'bg-emerald-900/20 text-emerald-500'
                            }`}
                          >
                            {isAudio ? '🎙️' : ext.slice(0, 3)}
                          </span>
                          <div>
                            <div className="text-white font-medium flex items-center gap-2">
                              <span
                                className="cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => (isAudio && onPlayAudio ? onPlayAudio(doc) : onViewDocument(doc))}
                              >
                                {doc.title}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Encrypted • {formatBytes(doc.fileSize)}
                              {doc.audioDurationSeconds ? ` • ⏱️ ${formatAudioDuration(doc.audioDurationSeconds)}` : ''}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-300">{catBadge.label.split(' ')[0]}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${expBadge.colorClass}`}>
                            {expBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {isAudio && onPlayAudio ? (
                              <button
                                onClick={() => onPlayAudio(doc)}
                                className="text-violet-400 hover:text-violet-300 text-xs font-semibold cursor-pointer"
                              >
                                ▶ Play
                              </button>
                            ) : (
                              <button
                                onClick={() => onViewDocument(doc)}
                                className="text-blue-500 hover:underline text-xs font-medium cursor-pointer"
                              >
                                View
                              </button>
                            )}

                            {/* Direct Hide action */}
                            {onHideDocument && (
                              <button
                                onClick={() => setConfirmHideDoc(doc)}
                                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-950/50"
                                title="🔒 Hide (Move to private Hidden Space)"
                              >
                                <EyeOff className="w-3 h-3" />
                                <span>Hide</span>
                              </button>
                            )}

                            {onEditDocument && (
                              <button
                                onClick={() => onEditDocument(doc)}
                                className="text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                                title="Rename / Re-categorize"
                              >
                                Edit
                              </button>
                            )}
                            {onShareDirect && (
                              <button
                                onClick={() => onShareDirect(doc)}
                                className="text-teal-400 hover:text-teal-300 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                                title="↗ Share Directly"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Direct</span>
                              </button>
                            )}
                            <button
                              onClick={() => onGenerateQr(doc)}
                              className="text-slate-400 hover:text-white text-xs font-medium cursor-pointer inline-flex items-center gap-1"
                              title="▣ Share via QR"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>QR</span>
                            </button>

                            {/* Three-dot dropdown menu */}
                            <div className="relative doc-menu-container inline-block text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuDocId(activeMenuDocId === `list-${doc.id}` ? null : `list-${doc.id}`);
                                }}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="More options"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {activeMenuDocId === `list-${doc.id}` && (
                                <div className="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-150 text-left">
                                  {onHideDocument && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuDocId(null);
                                        setConfirmHideDoc(doc);
                                      }}
                                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <EyeOff className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                      <span>🔒 Hide Item</span>
                                    </button>
                                  )}
                                  {onShareDirect && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuDocId(null);
                                        onShareDirect(doc);
                                      }}
                                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-teal-300 hover:bg-teal-950/60 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <ArrowUpRight className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                      <span>↗ Share Directly</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuDocId(null);
                                      onGenerateQr(doc);
                                    }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>▣ Share via QR</span>
                                  </button>

                                  <div className="h-px bg-slate-800 my-1" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuDocId(null);
                                      if (confirm(`Delete "${doc.title}"?`)) onDeleteDocument(doc.id);
                                    }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Delete Item</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Shared Links Card */}
          <div className="pt-2">
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center justify-between">
                <span>Active Shares</span>
                <span className="text-[10px] text-slate-500">{activeQrCount} Active</span>
              </h3>
              <div className="space-y-2">
                {documents.filter(d => d.shareCount > 0).slice(0, 3).length > 0 ? (
                  documents
                    .filter(d => d.shareCount > 0)
                    .slice(0, 3)
                    .map(d => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50"
                      >
                        <div className="text-xs font-medium text-white truncate max-w-[240px]">{d.title}</div>
                        <div className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                          {d.shareCount} active link{d.shareCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    No active QR share links. Generate one anytime.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean High-Contrast QR Sharing Card & System Status */}
        <div className="lg:col-span-4 space-y-6">
          {/* Prominent Clean Minimalist White QR Sharing Card */}
          <div className="bg-white text-slate-900 p-6 rounded-3xl shadow-xl shadow-blue-500/10 flex flex-col items-center text-center">
            <div className="bg-slate-100 p-2.5 rounded-xl border-2 border-slate-900 mb-4">
              <div className="w-32 h-32 bg-slate-900 rounded-lg flex flex-wrap p-2.5">
                <div className="w-full h-full border border-white/20 grid grid-cols-4 gap-1">
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white"></div>
                  <div className="bg-transparent"></div>
                  <div className="bg-white"></div>
                </div>
              </div>
            </div>

            <h3 className="font-bold text-lg leading-tight text-slate-950">Secure QR Sharing</h3>
            <p className="text-[11px] text-slate-500 mt-2 px-2">
              Generate a time-limited QR code for temporary document access with zero disk caching.
            </p>

            <div className="w-full mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium border-t border-slate-100 pt-3">
                <span className="text-slate-600">Expiry Time</span>
                <span className="text-blue-600 font-semibold">10 Minutes</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-600">Access Limit</span>
                <span className="text-blue-600 font-semibold">Single Use / Auto-Burn</span>
              </div>
              <button
                onClick={() => {
                  if (documents.length > 0) {
                    onGenerateQr(documents[0]);
                  }
                }}
                disabled={documents.length === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold mt-2 transition-colors cursor-pointer"
              >
                {documents.length > 0 ? 'Configure & Share Document' : 'No Documents in Vault'}
              </button>
            </div>
          </div>

          {/* System Status Minimalist Widget */}
          <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">System Status</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300">MFA (2FA)</span>
              <span className="text-xs text-emerald-400 font-bold">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300">End-to-End Encryption</span>
              <span className="text-xs text-emerald-400 font-bold">VERIFIED</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300">AEAD Tag Check</span>
              <span className="text-xs text-emerald-400 font-bold">128-BIT GCM</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-300">Storage Capacity</span>
              <span className="text-xs text-blue-400 font-bold">UNLIMITED</span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs text-slate-300 font-medium">Storage Used:</span>
              </div>
              <span className="text-xs font-mono font-bold text-white">
                {formatBytes(totalStorage)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hide Item Confirmation Modal */}
      {confirmHideDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                <EyeOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Hide Item?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Move to private Hidden Space</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">{confirmHideDoc.title}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This item will be removed from your main dashboard, category counts, and search results. It will be stored exclusively in your private <strong className="text-indigo-300">Hidden Space</strong>.
              </p>
            </div>

            <div className="text-[11px] text-slate-400 flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>The item is safe and not deleted. Original content, attachments, and AES-256 encryption are fully preserved.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmHideDoc(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = confirmHideDoc;
                  setConfirmHideDoc(null);
                  if (onHideDocument) {
                    onHideDocument(doc);
                  }
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Item</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
