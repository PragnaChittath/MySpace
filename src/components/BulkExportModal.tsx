import React, { useState, useMemo } from 'react';
import {
  Download,
  ShieldCheck,
  EyeOff,
  Lock,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  FileText,
  Key,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import { VaultDocument, User } from '../types.js';
import { generateBulkEncryptedZip, ExportProgress, ExportResult } from '../utils/vaultZipExport.js';
import { api } from '../services/api.js';

interface BulkExportModalProps {
  currentUser: User | null;
  documents: VaultDocument[];
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess?: (result: ExportResult) => void;
}

export function BulkExportModal({
  currentUser,
  documents = [],
  isOpen,
  onClose,
  onExportSuccess
}: BulkExportModalProps) {
  // 1. Separate non-hidden and hidden documents
  const nonHiddenDocs = useMemo(() => documents.filter(d => !d.isHidden), [documents]);
  const hiddenDocsCount = useMemo(() => documents.filter(d => d.isHidden).length, [documents]);

  // Selected document IDs to include in export (default: all non-hidden)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // Initialize selection when modal opens
  React.useEffect(() => {
    if (isOpen && !hasInitializedSelection) {
      setSelectedDocIds(nonHiddenDocs.map(d => d.id));
      setHasInitializedSelection(true);
    } else if (!isOpen) {
      setHasInitializedSelection(false);
      setIsProcessing(false);
      setProgress(null);
      setExportResult(null);
      setErrorMessage('');
    }
  }, [isOpen, nonHiddenDocs, hasInitializedSelection]);

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [organizeByCategory, setOrganizeByCategory] = useState(true);
  const [includeOfflineDecryptor, setIncludeOfflineDecryptor] = useState(true);
  const [includeManifest, setIncludeManifest] = useState(true);
  const [customArchiveName, setCustomArchiveName] = useState('');
  const [showFileList, setShowFileList] = useState(false);

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen) return null;

  // Selected documents
  const targetDocs = nonHiddenDocs.filter(d => selectedDocIds.includes(d.id));
  const totalBytes = targetDocs.reduce((acc, d) => acc + (d.fileSize || 0), 0);

  // Category counts
  const categoryStats = targetDocs.reduce((acc, doc) => {
    acc[doc.category] = (acc[doc.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Password strength calculation
  const passwordStrength = (() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500', textColor: 'text-rose-400' };
    if (score <= 4) return { score: 2, label: 'Good', color: 'bg-amber-500', textColor: 'text-amber-400' };
    return { score: 3, label: 'Strong (AES-256 Ready)', color: 'bg-emerald-500', textColor: 'text-emerald-400' };
  })();

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Generate strong random passphrase
  const handleGeneratePassphrase = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 16; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  const handleToggleSelectAll = () => {
    if (selectedDocIds.length === nonHiddenDocs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(nonHiddenDocs.map(d => d.id));
    }
  };

  const handleToggleDoc = (id: string) => {
    setSelectedDocIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleStartExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (targetDocs.length === 0) {
      setErrorMessage('Please select at least one document to export.');
      return;
    }

    if (!password) {
      setErrorMessage('Please provide a master encryption password for the archive.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Archive password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    setIsProcessing(true);
    setProgress({
      stage: 'FETCHING',
      message: 'Initializing bulk export pipeline...',
      percent: 5,
      totalFiles: targetDocs.length,
      processedFiles: 0
    });

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const defaultName = `myspace-vault-export-${dateStr}.zip`;
      const finalArchiveName = customArchiveName.trim()
        ? (customArchiveName.endsWith('.zip') ? customArchiveName : `${customArchiveName}.zip`)
        : defaultName;

      // 1. Generate encrypted zip using WebCrypto and JSZip
      const result = await generateBulkEncryptedZip(targetDocs, password, {
        organizeByCategory,
        includeOfflineDecryptor,
        includeManifest,
        archiveName: finalArchiveName,
        onProgress: (p) => setProgress(p)
      });

      // 2. Audit log to backend
      await api.auditExportDownload({
        userId: currentUser?.id,
        documentCount: targetDocs.length,
        fileName: result.fileName,
        checksumSha256: result.checksumSha256
      });

      setExportResult(result);

      // 3. Trigger immediate download
      const downloadUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

      if (onExportSuccess) {
        onExportSuccess(result);
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while generating the archive.');
      setIsProcessing(false);
    }
  };

  const handleCopyChecksum = () => {
    if (exportResult?.checksumSha256) {
      navigator.clipboard.writeText(exportResult.checksumSha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadAgain = () => {
    if (exportResult) {
      const downloadUrl = URL.createObjectURL(exportResult.blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = exportResult.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
    }
  };

  return (
    <div
      id="modal-bulk-export-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="modal-bulk-export-container"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 my-8 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/10 shrink-0">
              <FileArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Bulk Vault Export</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Download all non-hidden documents into a standalone, encrypted ZIP archive.
              </p>
            </div>
          </div>

          <button
            id="btn-close-bulk-export"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3 animate-in shake duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* SUCCESS VIEW */}
        {exportResult ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 py-2">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Encrypted Archive Ready!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Your download has started automatically. All <strong className="text-white">{exportResult.documentsCount} documents</strong> were authenticated with AES-256-GCM encryption.
              </p>
            </div>

            {/* Archive Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
                <span className="text-slate-300">Archive File:</span>
                <span className="text-white font-semibold">{exportResult.fileName}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
                <span className="text-slate-300">Archive Size:</span>
                <span className="text-emerald-400 font-semibold">{(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>SHA-256 Integrity Checksum:</span>
                  <button
                    onClick={handleCopyChecksum}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 break-all select-all">
                  {exportResult.checksumSha256}
                </div>
              </div>
            </div>

            {/* Offline Decryptor Guide */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>How to Decrypt Offline:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                1. Unzip the downloaded archive on your computer.<br />
                2. Double-click <strong className="text-white font-mono">vault-decryptor.html</strong> in Chrome, Safari, Edge, or Firefox.<br />
                3. Enter your Master Archive Password to preview or export your original files with 100% offline privacy.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                id="btn-export-download-again"
                type="button"
                onClick={handleDownloadAgain}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <Download className="w-4 h-4" />
                <span>Download Archive Again</span>
              </button>
              <button
                id="btn-export-finish"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : isProcessing ? (
          /* ACTIVE PROCESSING STATE */
          <div className="py-8 space-y-6 text-center animate-in fade-in duration-200">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-3xl bg-blue-500/20 animate-ping opacity-50" />
              <div className="relative w-20 h-20 rounded-3xl bg-slate-800 border-2 border-blue-500 flex items-center justify-center text-blue-400 shadow-2xl shadow-blue-500/30">
                <Cpu className="w-10 h-10 animate-pulse text-blue-400" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">Encrypting Vault Backup...</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {progress?.message || 'Processing documents...'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  {progress?.currentFile ? `Encrypting: ${progress.currentFile}` : 'Preparing ZIP package...'}
                </span>
                <span className="text-blue-400 font-bold">{progress?.percent || 0}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>PBKDF2 (100,000 iter) • AES-256-GCM AEAD • SHA-256 Hash</span>
            </div>
          </div>
        ) : (
          /* CONFIGURATION FORM */
          <form onSubmit={handleStartExport} className="space-y-6">
            {/* Non-Hidden Scope Notice */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Scope: Non-Hidden Vault Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    {targetDocs.length} Document{targetDocs.length !== 1 ? 's' : ''} ({(totalBytes / 1024).toFixed(1)} KB)
                  </span>
                  {hiddenDocsCount > 0 && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-semibold border border-indigo-500/30 flex items-center gap-1">
                      <EyeOff className="w-3 h-3 text-indigo-400" />
                      {hiddenDocsCount} Hidden Excluded
                    </span>
                  )}
                </div>
              </div>

              {/* Categorization Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(categoryStats).map(([category, count]) => (
                  <span
                    key={category}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-medium"
                  >
                    {category}: <strong className="text-white">{count}</strong>
                  </span>
                ))}
              </div>

              {/* Collapsible Document Selection */}
              <div className="pt-2 border-t border-slate-700/40">
                <button
                  type="button"
                  onClick={() => setShowFileList(!showFileList)}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Review & Customize Document List</span>
                  </span>
                  {showFileList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFileList && (
                  <div className="mt-3 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-1 text-[10px] text-slate-400">
                      <span>Select documents to package:</span>
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-blue-400 hover:underline cursor-pointer font-medium"
                      >
                        {selectedDocIds.length === nonHiddenDocs.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {nonHiddenDocs.map(doc => (
                        <label
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(doc.id)}
                              onChange={() => handleToggleDoc(doc.id)}
                              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800 cursor-pointer"
                            />
                            <span className="text-white font-medium truncate">{doc.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({doc.fileName})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 uppercase font-mono">
                            {doc.category}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Master Archive Password Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  <span>Archive Master Password</span>
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassphrase}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Strong Password</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    id="input-export-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter archive password..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="input-export-password-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password..."
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    required
                  />
                  {confirmPassword && (
                    <div className="absolute right-3 top-2.5">
                      {passwordsMatch ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Strength:</span>
                    <span className={`font-semibold ${passwordStrength.textColor}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="flex gap-1 w-28">
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-800'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-800'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-800'}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Archive Options */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300">Packaging Options</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                  <input
                    id="checkbox-offline-decryptor"
                    type="checkbox"
                    checked={includeOfflineDecryptor}
                    onChange={(e) => setIncludeOfflineDecryptor(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Embed Offline Decryptor</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Includes <span className="font-mono text-blue-300">vault-decryptor.html</span> to view & export anywhere without app install.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                  <input
                    id="checkbox-organize-category"
                    type="checkbox"
                    checked={organizeByCategory}
                    onChange={(e) => setOrganizeByCategory(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Category Folder Structure</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Organizes files into <span className="font-mono text-blue-300">IDENTITY/</span>, <span className="font-mono text-blue-300">FINANCIAL/</span>, etc.
                    </div>
                  </div>
                </label>
              </div>

              {/* Archive Name input */}
              <div className="pt-1">
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Custom Archive Name (optional)
                </label>
                <input
                  id="input-custom-archive-name"
                  type="text"
                  value={customArchiveName}
                  onChange={(e) => setCustomArchiveName(e.target.value)}
                  placeholder={`myspace-vault-export-${new Date().toISOString().split('T')[0]}.zip`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Zero-Leakage Guarantee */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero-knowledge client-side encryption. Passwords and keys are never transmitted to any third party.</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                id="btn-cancel-bulk-export"
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-bulk-export"
                type="submit"
                disabled={targetDocs.length === 0 || !password || password !== confirmPassword}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Download className="w-4 h-4" />
                <span>Export & Encrypt ZIP ({targetDocs.length})</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
