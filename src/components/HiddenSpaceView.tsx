import { useState } from 'react';
import {
  EyeOff,
  Unlock,
  Trash2,
  QrCode,
  Lock,
  ArrowLeft,
  Search,
  Layers,
  FileText,
  FileAudio,
  Play,
  Sparkles,
  Shield,
  CheckCircle2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { VaultDocument, User, DocumentCategory } from '../types.js';
import {
  formatBytes,
  formatDate,
  getExpiryStatus,
  getCategoryBadge,
  formatAudioDuration,
  isAudioFile
} from '../utils/formatters.js';

interface HiddenSpaceViewProps {
  currentUser?: User | null;
  hiddenDocuments: VaultDocument[];
  onExitHiddenSpace: () => void;
  onViewDocument: (doc: VaultDocument) => void;
  onPlayAudio?: (doc: VaultDocument) => void;
  onGenerateQr?: (doc: VaultDocument) => void;
  onUnhideDocument: (doc: VaultDocument) => void;
  onDeleteDocument: (docId: string) => void;
  isLoading: boolean;
}

export function HiddenSpaceView({
  currentUser,
  hiddenDocuments,
  onExitHiddenSpace,
  onViewDocument,
  onPlayAudio,
  onGenerateQr,
  onUnhideDocument,
  onDeleteDocument,
  isLoading
}: HiddenSpaceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Confirmation modal states
  const [confirmUnhideDoc, setConfirmUnhideDoc] = useState<VaultDocument | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<VaultDocument | null>(null);

  // Filter hidden documents
  const filteredDocs = hiddenDocuments.filter(doc => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.documentNumber && doc.documentNumber.toLowerCase().includes(q)) ||
      (doc.tags && doc.tags.some(t => t.toLowerCase().includes(q))) ||
      (doc.notes && doc.notes.toLowerCase().includes(q)) ||
      (doc.category && doc.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Top Header with Discreet Exit Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-lg shadow-indigo-500/10 shrink-0">
            <EyeOff className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Hidden Space
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Private Room
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              “Your private things, kept out of sight.”
            </p>
          </div>
        </div>

        {/* Magic Close / Exit Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            id="btn-exit-hidden-space"
            onClick={onExitHiddenSpace}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Exit Hidden Space</span>
            <Lock className="w-3 h-3 text-indigo-400 ml-1" />
          </button>
        </div>
      </div>

      {/* Security Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/25 border border-indigo-500/20 text-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Items in this space are completely hidden from normal searches, category filters, and the standard dashboard.
          </span>
        </div>
        <div className="text-[11px] font-mono text-indigo-300/80 shrink-0">
          AES-256-GCM at rest • Zero Disk Leaks
        </div>
      </div>

      {/* Search and Layout Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search hidden items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-xs text-slate-400">
            {filteredDocs.length} hidden item{filteredDocs.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Grid View"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="List View"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 mt-3">Accessing private encrypted partition...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3.5">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white">
            {searchQuery ? 'No matching hidden items' : 'No hidden items in your private space'}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? 'Try adjusting your search keywords.'
              : 'You can hide any document, photo, or voice note from your main dashboard by selecting the “Hide” option on its card or long-pressing on mobile.'}
          </p>
          <div className="mt-5">
            <button
              onClick={onExitHiddenSpace}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Vault Dashboard
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="group flex flex-col justify-between rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all p-5 text-slate-300 relative shadow-sm"
              >
                <div>
                  {/* Top row: Format Pill + Hidden Marker + Expiry Status */}
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

                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Hidden
                      </span>
                      {doc.expiryDate && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${expBadge.colorClass}`}>
                          {expBadge.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Document Title */}
                  <h3
                    onClick={() => (isAudio && onPlayAudio ? onPlayAudio(doc) : onViewDocument(doc))}
                    className="font-medium text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-1 cursor-pointer flex items-center gap-1.5"
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

                  {/* Dates: Added/Hidden date */}
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Created {formatDate(doc.createdAt)}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isAudio && onPlayAudio ? (
                      <button
                        onClick={() => onPlayAudio(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-bold border border-violet-500/30 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-violet-300" />
                        <span>Play</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onViewDocument(doc)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                      >
                        View Details
                      </button>
                    )}
                  </div>

                  {/* Unhide / Share / Delete Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConfirmUnhideDoc(doc)}
                      className="p-1.5 rounded-md bg-slate-800/90 hover:bg-emerald-950/60 text-emerald-400 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 transition-colors cursor-pointer"
                      title="Restore / Unhide to normal vault dashboard"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                    </button>
                    {onGenerateQr && (
                      <button
                        onClick={() => onGenerateQr(doc)}
                        className="p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                        title="Share without unhiding"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteDoc(doc)}
                      className="p-1.5 rounded-md bg-slate-800/90 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800">
              {filteredDocs.map(doc => {
                const ext = doc.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                const isAudio = isAudioFile(doc.fileType, doc.fileName, doc.category);
                const isPdf = ext === 'PDF';
                const isImg = ext === 'JPG' || ext === 'PNG' || ext === 'JPEG';
                const catBadge = getCategoryBadge(doc.category);

                return (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
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
                            className="cursor-pointer hover:text-indigo-400 transition-colors"
                            onClick={() => (isAudio && onPlayAudio ? onPlayAudio(doc) : onViewDocument(doc))}
                          >
                            {doc.title}
                          </span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Hidden
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
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
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
                          className="text-indigo-400 hover:underline text-xs font-medium cursor-pointer"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmUnhideDoc(doc)}
                        className="text-emerald-400 hover:underline text-xs font-medium cursor-pointer inline-flex items-center gap-1"
                        title="Restore to vault"
                      >
                        <Unlock className="w-3 h-3" />
                        Unhide
                      </button>
                      {onGenerateQr && (
                        <button
                          onClick={() => onGenerateQr(doc)}
                          className="text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                          title="Share without unhiding"
                        >
                          Share
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteDoc(doc)}
                        className="text-slate-500 hover:text-rose-400 text-xs font-medium cursor-pointer"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal: Unhide Item */}
      {confirmUnhideDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Restore Item to Vault?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Move back to normal vault dashboard</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-800">
              <strong className="text-white font-medium">“{confirmUnhideDoc.title}”</strong> will be returned to your main vault dashboard and original category (<span className="text-slate-200">{confirmUnhideDoc.category}</span>). It will once again be visible in normal searches and recent item lists.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmUnhideDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const doc = confirmUnhideDoc;
                  setConfirmUnhideDoc(null);
                  onUnhideDocument(doc);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                Restore to Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Item */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Item?</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-800">
              Are you sure you want to permanently delete <strong className="text-white font-medium">“{confirmDeleteDoc.title}”</strong>? The AES-256-GCM ciphertext will be purged from storage.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = confirmDeleteDoc.id;
                  setConfirmDeleteDoc(null);
                  onDeleteDocument(id);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
