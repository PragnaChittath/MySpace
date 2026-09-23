import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  QrCode,
  Clock,
  Flame,
  Copy,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  X,
  Eye,
  EyeOff,
  KeyRound,
  FileDown,
  Printer,
  Share2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  MessageSquare,
  Ban,
  Sliders,
  FileText,
  Info,
  ArrowUpRight,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import {
  VaultDocument,
  ShareLink,
  AccessType,
  RecipientVerification,
  CreateSharePayload,
  WatermarkConfig,
  AdvancedSharingSecurity,
  SharePermission,
  ShareMethod
} from '../types.js';
import { api } from '../services/api.js';
import { formatBytes, formatDate, getCategoryBadge, getTimeRemainingString, getShareStatusBadge } from '../utils/formatters.js';

interface SecureSharingModalProps {
  document: VaultDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onShareCreated: (share: ShareLink) => void;
  onOpenPublicView: (token: string) => void;
  initialMode?: 'DIRECT' | 'QR';
}

export function SecureSharingModal({
  document: doc,
  isOpen,
  onClose,
  onShareCreated,
  onOpenPublicView,
  initialMode = 'DIRECT'
}: SecureSharingModalProps) {
  // Share mode: 'DIRECT' (Share Directly) vs 'QR' (Share via QR)
  const [shareMode, setShareMode] = useState<ShareMethod>(initialMode);

  // Step: 'SETTINGS' -> 'RESULT'
  const [step, setStep] = useState<'SETTINGS' | 'RESULT'>('SETTINGS');

  // Sensitive Document Preset
  const [isSensitive, setIsSensitive] = useState(false);

  // Access Permission: 'VIEW_ONLY' | 'DOWNLOAD' | 'VIEW_AND_DOWNLOAD'
  const [permissionOption, setPermissionOption] = useState<SharePermission>('VIEW_ONLY');

  // Access Duration
  const [durationPreset, setDurationPreset] = useState<'1h' | '6h' | '24h' | '3d' | '7d' | 'custom' | 'none'>('24h');
  const [customDurationValue, setCustomDurationValue] = useState<number>(24);
  const [customDurationUnit, setCustomDurationUnit] = useState<'minutes' | 'hours' | 'days'>('hours');

  // Optional Extra Protection
  const [requirePassword, setRequirePassword] = useState<boolean>(false);
  const [sharingPassword, setSharingPassword] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);

  const [requireOtp, setRequireOtp] = useState<boolean>(false);
  const [customOtp, setCustomOtp] = useState<string>('');

  // Expose owner name on recipient landing page
  const [showOwnerName, setShowOwnerName] = useState<boolean>(true);

  // Maximum Views / Burn Count
  const [maxViewsPreset, setMaxViewsPreset] = useState<'1' | '3' | '5' | '10' | 'unlimited' | 'custom'>('unlimited');
  const [customMaxViews, setCustomMaxViews] = useState<number>(3);

  // Content security policies
  const [restrictScreenCapture, setRestrictScreenCapture] = useState<boolean>(true);
  const [allowPrint, setAllowPrint] = useState<boolean>(false);
  const [preventReshare, setPreventReshare] = useState<boolean>(true);

  // Watermark Settings
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [customWatermarkText, setCustomWatermarkText] = useState<string>('Confidential – Shared via MySpace');

  // Advanced Security Options (Expandable)
  const [showAdvancedSecurity, setShowAdvancedSecurity] = useState<boolean>(false);
  const [oneDeviceOnly, setOneDeviceOnly] = useState<boolean>(false);
  const [notifyOnOpen, setNotifyOnOpen] = useState<boolean>(true);
  const [notifyOnDownload, setNotifyOnDownload] = useState<boolean>(true);

  // Existing Active Shares for this document
  const [activeShares, setActiveShares] = useState<ShareLink[]>([]);
  const [loadingShares, setLoadingShares] = useState<boolean>(false);
  const [showActiveSharesSection, setShowActiveSharesSection] = useState<boolean>(true);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  const showModalFeedback = (type: 'success' | 'error', message: string) => {
    setModalFeedback({ type, message });
    setTimeout(() => setModalFeedback(null), 3500);
  };

  // Generated Result State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedShare, setGeneratedShare] = useState<(ShareLink & { publicShareUrl: string; simulatedOtp?: string }) | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Synchronize initial mode when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        setShareMode(initialMode);
      }
      setStep('SETTINGS');
      setGeneratedShare(null);
      setCopiedLink(false);
      setCopiedOtp(false);
      setCopiedPassword(false);
    }
  }, [isOpen, initialMode]);

  // Load existing shares for this document
  const loadDocumentShares = async () => {
    if (!doc) return;
    setLoadingShares(true);
    try {
      const allShares = await api.getShares(doc.userId);
      const docShares = allShares.filter(s => s.documentId === doc.id);
      setActiveShares(docShares);
    } catch (e) {
      console.warn('Failed to load active shares for document', e);
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    if (doc && isOpen) {
      loadDocumentShares();
    }
  }, [doc, isOpen]);

  // Auto-detect high sensitivity documents
  useEffect(() => {
    if (!doc || !isOpen) return;

    const titleLower = doc.title.toLowerCase();
    const isSensitiveCategory =
      doc.category === 'IDENTITY' ||
      doc.category === 'FINANCIAL' ||
      doc.category === 'MEDICAL' ||
      doc.category === 'LEGAL';
    const isSensitiveKeyword =
      titleLower.includes('aadhaar') ||
      titleLower.includes('pan') ||
      titleLower.includes('passport') ||
      titleLower.includes('license') ||
      titleLower.includes('medical') ||
      titleLower.includes('certificate');

    if (isSensitiveCategory || isSensitiveKeyword) {
      applySensitivePreset();
    } else {
      setIsSensitive(false);
      setPermissionOption('VIEW_ONLY');
      setDurationPreset('24h');
      setMaxViewsPreset('unlimited');
      setRestrictScreenCapture(true);
      setAllowPrint(false);
      setPreventReshare(true);
      setWatermarkEnabled(true);
      setNotifyOnOpen(true);
      setNotifyOnDownload(true);
    }
  }, [doc, isOpen]);

  const applySensitivePreset = () => {
    setIsSensitive(true);
    setPermissionOption('VIEW_ONLY');
    setDurationPreset('24h');
    setMaxViewsPreset('5');
    setRequireOtp(true);
    if (!customOtp) {
      setCustomOtp(Math.floor(100000 + Math.random() * 900000).toString());
    }
    setRestrictScreenCapture(true);
    setAllowPrint(false);
    setPreventReshare(true);
    setWatermarkEnabled(true);
    setOneDeviceOnly(false);
    setNotifyOnOpen(true);
    setNotifyOnDownload(true);
  };

  const removeSensitivePreset = () => {
    setIsSensitive(false);
    setRequireOtp(false);
    setMaxViewsPreset('unlimited');
  };

  if (!isOpen || !doc) return null;

  // Calculate duration in minutes
  const calculateDurationMinutes = (): number | null => {
    switch (durationPreset) {
      case '1h': return 60;
      case '6h': return 360;
      case '24h': return 1440;
      case '3d': return 4320;
      case '7d': return 10080;
      case 'none': return null;
      case 'custom':
        if (customDurationUnit === 'minutes') return Math.max(1, customDurationValue);
        if (customDurationUnit === 'hours') return Math.max(1, customDurationValue * 60);
        if (customDurationUnit === 'days') return Math.max(1, customDurationValue * 1440);
        return 1440;
    }
  };

  // Calculate max views
  const calculateMaxViews = (): number | null => {
    switch (maxViewsPreset) {
      case '1': return 1;
      case '3': return 3;
      case '5': return 5;
      case '10': return 10;
      case 'unlimited': return null;
      case 'custom': return Math.max(1, customMaxViews);
    }
  };

  const durationMinutes = calculateDurationMinutes();
  const maxAccessCount = calculateMaxViews();

  // Helper text for duration
  const getDurationSummary = () => {
    if (durationMinutes === null) return 'Never expires';
    if (durationMinutes < 60) return `${durationMinutes} Minutes`;
    if (durationMinutes === 60) return '1 Hour';
    if (durationMinutes === 360) return '6 Hours';
    if (durationMinutes === 1440) return '24 Hours';
    if (durationMinutes === 4320) return '3 Days';
    if (durationMinutes === 10080) return '7 Days';
    if (durationMinutes % 1440 === 0) return `${durationMinutes / 1440} Days`;
    return `${(durationMinutes / 60).toFixed(1)} Hours`;
  };

  const getPermissionLabel = (perm: SharePermission) => {
    if (perm === 'VIEW_ONLY') return 'View Only';
    if (perm === 'DOWNLOAD') return 'Download';
    return 'View + Download';
  };

  // Handle Submission: Confirm & Generate Share
  const handleConfirmAndGenerate = async () => {
    setIsGenerating(true);
    try {
      const watermarkConfig: WatermarkConfig = {
        enabled: watermarkEnabled,
        ownerName: showOwnerName ? doc.ownerName : undefined,
        showTimestamp: true,
        customText: customWatermarkText
      };

      const advancedSec: AdvancedSharingSecurity = {
        autoExpire: durationMinutes !== null,
        revokeAnytime: true,
        oneDeviceOnly,
        restrictToVerifiedRecipient: requireOtp || requirePassword,
        notifyOnOpen,
        notifyOnDownload,
        maintainAccessHistory: true,
        failedAuthAttempts: 0
      };

      const verificationType: RecipientVerification = requireOtp
        ? 'OTP'
        : requirePassword
        ? 'PIN'
        : 'NONE';

      const payload: CreateSharePayload = {
        documentId: doc.id,
        durationMinutes,
        maxAccessCount,
        permission: permissionOption,
        shareMethod: shareMode,
        showOwnerName,
        allowDownload: permissionOption === 'DOWNLOAD' || permissionOption === 'VIEW_AND_DOWNLOAD',
        restrictScreenCapture,
        allowPrint,
        preventReshare,
        accessType: requireOtp ? 'REQUIRE_OTP' : requirePassword ? 'REQUIRE_PIN' : 'ANYONE',
        recipientVerification: verificationType,
        passcode: requirePassword ? sharingPassword : undefined,
        passcodeHint: requirePassword ? 'Owner-created sharing password required' : undefined,
        otpCode: requireOtp ? (customOtp || Math.floor(100000 + Math.random() * 900000).toString()) : undefined,
        watermark: watermarkConfig,
        advancedSecurity: advancedSec,
        isSensitivePreset: isSensitive
      };

      const res = await api.createShare(payload);
      setGeneratedShare(res);
      onShareCreated(res);
      setStep('RESULT');
      loadDocumentShares();
    } catch (err: any) {
      showModalFeedback('error', err.message || 'Failed to generate secure sharing link.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    if (!generatedShare) return;
    navigator.clipboard.writeText(generatedShare.publicShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Copy OTP
  const handleCopyOtp = () => {
    if (!generatedShare?.otpCode) return;
    navigator.clipboard.writeText(generatedShare.otpCode);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  // Copy Password
  const handleCopyPassword = () => {
    if (!sharingPassword) return;
    navigator.clipboard.writeText(sharingPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Web Share API
  const handleNativeShare = async () => {
    if (!generatedShare) return;
    const shareText = `Secure document shared via MySpace: "${doc.title}"${durationMinutes ? ` (Expires in ${getDurationSummary()})` : ''}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MySpace Secure Document: ${doc.title}`,
          text: shareText,
          url: generatedShare.publicShareUrl
        });
      } catch (e) {
        // User cancelled or share failed, fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Download QR Code PNG
  const handleDownloadQr = () => {
    if (!generatedShare?.qrCodeDataUrl) return;
    const a = window.document.createElement('a');
    a.href = generatedShare.qrCodeDataUrl;
    a.download = `myspace-qr-${doc.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  // Revoke active share
  const handleRevokeShare = async () => {
    if (!generatedShare) return;
    if (!confirm('Revoke access to this sharing link immediately? Any recipient accessing this link will see "This sharing link is no longer available."')) return;
    setRevoking(true);
    try {
      await api.revokeShare(generatedShare.id, 'Revoked directly by document owner');
      setGeneratedShare(prev => prev ? { ...prev, status: 'REVOKED' } : null);
      loadDocumentShares();
      showModalFeedback('success', 'Access link revoked successfully.');
    } catch (e) {
      showModalFeedback('error', 'Failed to revoke access link.');
    } finally {
      setRevoking(false);
    }
  };

  // Revoke individual share from active list
  const handleRevokeFromList = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this active share link? It will be immediately invalidated.')) return;
    setRevokingShareId(shareId);
    try {
      await api.revokeShare(shareId, 'Revoked from document sharing panel');
      loadDocumentShares();
      showModalFeedback('success', 'Active share revoked.');
    } catch (e) {
      showModalFeedback('error', 'Failed to revoke share link.');
    } finally {
      setRevokingShareId(null);
    }
  };

  const catBadge = getCategoryBadge(doc.category);
  const activeCount = activeShares.filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 text-slate-100 my-8 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header & Sharing Method Selector */}
        <div className="pb-4 border-b border-slate-800 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md ${
                shareMode === 'DIRECT'
                  ? 'bg-teal-500/15 border-teal-500/30 text-teal-400 shadow-teal-950/40'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-indigo-950/40'
              }`}>
                {shareMode === 'DIRECT' ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> : <QrCode className="w-5 h-5 stroke-[2.5]" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  {step === 'SETTINGS' ? 'Share Document' : (shareMode === 'DIRECT' ? 'Document Ready to Share' : 'Encrypted QR Code Ready')}
                  {isSensitive && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Sensitive Protected
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  {step === 'SETTINGS'
                    ? (shareMode === 'DIRECT'
                        ? 'Generate a temporary secure link without requiring QR scanning'
                        : 'Configure security policies and generate an encrypted QR code')
                    : 'Your temporary access link has been cryptographically generated and is ready to share.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sharing Method Switcher (Direct Share vs QR Share) */}
          <div className="flex items-center gap-2 p-1 bg-slate-950/90 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setShareMode('DIRECT')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shareMode === 'DIRECT'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>↗ Share Directly</span>
            </button>
            <button
              type="button"
              onClick={() => setShareMode('QR')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                shareMode === 'QR'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>▣ Share via QR</span>
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="overflow-y-auto flex-1 pr-1 my-4 space-y-5">
          {/* In-Modal Feedback Alert */}
          {modalFeedback && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
              modalFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {modalFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{modalFeedback.message}</span>
            </div>
          )}

          {/* Document Preview & Sharing Status Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{doc.title}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${catBadge.colorClass} shrink-0`}>
                    {catBadge.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5 font-mono">
                  <span>Type: {doc.fileType.split('/')[1]?.toUpperCase() || 'DOCUMENT'}</span>
                  <span>•</span>
                  <span>Size: {formatBytes(doc.fileSize)}</span>
                  {activeCount > 0 ? (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-bold">{activeCount} Active Share{activeCount > 1 ? 's' : ''}</span>
                    </>
                  ) : (
                    <>
                      <span>•</span>
                      <span className="text-slate-400">Ready to share</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <div className="text-right font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Permission</span>
                <span className="font-bold text-teal-300">{getPermissionLabel(permissionOption)}</span>
              </div>
              <div className="text-right font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Expiry</span>
                <span className="font-bold text-cyan-300">{getDurationSummary()}</span>
              </div>
            </div>
          </div>

          {step === 'SETTINGS' ? (
            /* STEP 1: CONFIGURATION FORM */
            <div className="space-y-5">
              {/* Sensitive Document Banner */}
              <div className={`p-4 rounded-2xl border transition-all ${
                isSensitive
                  ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/50 border-slate-800 text-slate-300'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSensitive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Sensitive Document Protection
                        {isSensitive && (
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            STRICT MODE ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        For sensitive documents, temporary expiration and recipient OTP/password are strongly encouraged.
                      </p>
                    </div>
                  </div>

                  {isSensitive ? (
                    <button
                      type="button"
                      onClick={removeSensitivePreset}
                      className="text-xs text-amber-300 hover:text-amber-100 font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-colors cursor-pointer"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applySensitivePreset}
                      className="text-xs text-slate-300 hover:text-white font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>

              {/* 1. ACCESS PERMISSIONS SELECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-400" />
                    Access Permissions
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Default: View Only</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* View Only */}
                  <div
                    onClick={() => setPermissionOption('VIEW_ONLY')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      permissionOption === 'VIEW_ONLY'
                        ? 'bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className={`w-4 h-4 ${permissionOption === 'VIEW_ONLY' ? 'text-teal-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">View Only</span>
                      </div>
                      <input
                        type="radio"
                        name="permissionOption"
                        checked={permissionOption === 'VIEW_ONLY'}
                        onChange={() => setPermissionOption('VIEW_ONLY')}
                        className="text-teal-500 focus:ring-teal-400 h-3.5 w-3.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      Recipient can securely view in browser. File download is restricted.
                    </p>
                  </div>

                  {/* Download */}
                  <div
                    onClick={() => setPermissionOption('DOWNLOAD')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      permissionOption === 'DOWNLOAD'
                        ? 'bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Download className={`w-4 h-4 ${permissionOption === 'DOWNLOAD' ? 'text-teal-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">Download</span>
                      </div>
                      <input
                        type="radio"
                        name="permissionOption"
                        checked={permissionOption === 'DOWNLOAD'}
                        onChange={() => setPermissionOption('DOWNLOAD')}
                        className="text-teal-500 focus:ring-teal-400 h-3.5 w-3.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      Recipient can download the original file directly to their device.
                    </p>
                  </div>

                  {/* View + Download */}
                  <div
                    onClick={() => setPermissionOption('VIEW_AND_DOWNLOAD')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      permissionOption === 'VIEW_AND_DOWNLOAD'
                        ? 'bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileDown className={`w-4 h-4 ${permissionOption === 'VIEW_AND_DOWNLOAD' ? 'text-teal-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">View + Download</span>
                      </div>
                      <input
                        type="radio"
                        name="permissionOption"
                        checked={permissionOption === 'VIEW_AND_DOWNLOAD'}
                        onChange={() => setPermissionOption('VIEW_AND_DOWNLOAD')}
                        className="text-teal-500 focus:ring-teal-400 h-3.5 w-3.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      Recipient can view the document in browser and download a copy.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. EXPIRATION SELECTION */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Expiration Window
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                    Selected: {getDurationSummary()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '1h', label: '1 Hour' },
                    { id: '6h', label: '6 Hours' },
                    { id: '24h', label: '24 Hours' },
                    { id: '3d', label: '3 Days' },
                    { id: '7d', label: '7 Days' },
                    { id: 'custom', label: 'Custom' },
                    { id: 'none', label: 'Never Expires' }
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDurationPreset(preset.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        durationPreset === preset.id
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom duration inputs */}
                {durationPreset === 'custom' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 animate-in fade-in">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDurationValue}
                      onChange={e => setCustomDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                    />
                    <select
                      value={customDurationUnit}
                      onChange={e => setCustomDurationUnit(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white cursor-pointer"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                    <span className="text-xs text-slate-400 font-mono">
                      (Total: {getDurationSummary()})
                    </span>
                  </div>
                )}

                {durationPreset === 'none' && (
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Links without expiration remain active until manually revoked. For sensitive documents, temporary expiration is recommended.</span>
                  </div>
                )}
              </div>

              {/* 3. OPTIONAL EXTRA PROTECTION */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Optional Extra Protection
                </div>

                {/* Password Protection */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-slate-300 flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      Require Password / Security PIN
                    </span>
                    <input
                      type="checkbox"
                      checked={requirePassword}
                      onChange={e => setRequirePassword(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-400 h-4 w-4 cursor-pointer"
                    />
                  </label>

                  {requirePassword && (
                    <div className="relative pt-1 animate-in fade-in">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        placeholder="Create a secret sharing password or PIN"
                        value={sharingPassword}
                        onChange={e => setSharingPassword(e.target.value)}
                        className="w-full px-3.5 py-2 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1">
                        The recipient will need to enter this password before the document content is revealed.
                      </p>
                    </div>
                  )}
                </div>

                {/* OTP Protection */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Require One-Time Passcode (OTP)
                    </span>
                    <input
                      type="checkbox"
                      checked={requireOtp}
                      onChange={e => setRequireOtp(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-400 h-4 w-4 cursor-pointer"
                    />
                  </label>

                  {requireOtp && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 animate-in fade-in">
                      <p className="text-[11px] text-slate-400">
                        Recipient must enter a 6-digit OTP to unlock this document. A one-time passcode will be generated for you to provide to the recipient.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs font-mono">Custom OTP (Optional):</span>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Auto-generated"
                          value={customOtp}
                          onChange={e => setCustomOtp(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-32 px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-mono tracking-wider font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Show Owner Name */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-slate-300 flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Display "Shared by {doc.ownerName}" on recipient page
                    </span>
                    <input
                      type="checkbox"
                      checked={showOwnerName}
                      onChange={e => setShowOwnerName(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-400 h-4 w-4 cursor-pointer"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5 pl-5">
                    Uncheck to share anonymously without displaying your vault username.
                  </p>
                </div>
              </div>

              {/* 4. ADVANCED SECURITY OPTIONS (ACCORDION) */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSecurity(!showAdvancedSecurity)}
                  className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Advanced Security & Anti-Leak Controls
                  </span>
                  {showAdvancedSecurity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedSecurity && (
                  <div className="p-4 pt-0 space-y-3 border-t border-slate-800/80 text-xs animate-in fade-in">
                    {/* Max Views Preset */}
                    <div className="space-y-1.5 pt-3">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        Maximum Allowed Views (Auto-Burn)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: '1', label: '1 View (Burn)' },
                          { id: '3', label: '3 Views' },
                          { id: '5', label: '5 Views' },
                          { id: 'unlimited', label: 'Unlimited' }
                        ].map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setMaxViewsPreset(preset.id as any)}
                            className={`py-1 px-2.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                              maxViewsPreset === preset.id
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Content Leak Protection */}
                    <div className="space-y-2 pt-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-300">Restrict Screen Capture / Text Selection</span>
                        <input
                          type="checkbox"
                          checked={restrictScreenCapture}
                          onChange={e => setRestrictScreenCapture(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-teal-500 h-4 w-4"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-300">Allow Printing</span>
                        <input
                          type="checkbox"
                          checked={allowPrint}
                          onChange={e => setAllowPrint(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-teal-500 h-4 w-4"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-300">Prevent Re-sharing</span>
                        <input
                          type="checkbox"
                          checked={preventReshare}
                          onChange={e => setPreventReshare(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-teal-500 h-4 w-4"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-300">Forensic Recipient Watermark</span>
                        <input
                          type="checkbox"
                          checked={watermarkEnabled}
                          onChange={e => setWatermarkEnabled(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-teal-500 h-4 w-4"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. ACTIVE SHARES SECTION */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowActiveSharesSection(!showActiveSharesSection)}
                  className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Active Shares for this Document
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {activeShares.length}
                    </span>
                  </span>
                  {showActiveSharesSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showActiveSharesSection && (
                  <div className="p-4 pt-0 border-t border-slate-800/80 text-xs space-y-2.5 animate-in fade-in">
                    {loadingShares ? (
                      <div className="py-4 text-center text-slate-400">Loading active shares...</div>
                    ) : activeShares.length === 0 ? (
                      <div className="py-4 text-center text-slate-500 font-mono text-[11px]">
                        No active share links created yet for this document.
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2">
                        {activeShares.map(sh => {
                          const statusBadge = getShareStatusBadge(sh.status);
                          const remaining = sh.expiresAt ? getTimeRemainingString(sh.expiresAt) : { text: 'No Expiry', isExpired: false };
                          const shareUrl = `${window.location.origin}/share/${sh.token}`;

                          return (
                            <div
                              key={sh.id}
                              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-xs truncate max-w-[200px]">
                                    {sh.documentTitle}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${statusBadge.colorClass}`}>
                                    {statusBadge.label}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                    {sh.shareMethod === 'DIRECT' ? '↗ Direct' : '▣ QR'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/40 text-teal-300 font-mono">
                                    {sh.permission === 'DOWNLOAD' ? 'Download' : sh.permission === 'VIEW_AND_DOWNLOAD' ? 'View + Download' : 'View Only'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono flex flex-wrap gap-2">
                                  <span>Created: {formatDate(sh.createdAt)}</span>
                                  <span>•</span>
                                  <span>Expires: {remaining.text}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(shareUrl);
                                    setCopiedShareId(sh.id);
                                    setTimeout(() => setCopiedShareId(null), 2000);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                                  title="Copy Link"
                                >
                                  {copiedShareId === sh.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedShareId === sh.id ? 'Copied' : 'Copy'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenPublicView(sh.token);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                                  title="Manage / View Recipient Page"
                                >
                                  <ExternalLink className="w-3 h-3" /> Manage
                                </button>
                                <button
                                  type="button"
                                  disabled={revokingShareId === sh.id || sh.status === 'REVOKED'}
                                  onClick={() => handleRevokeFromList(sh.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  title="Revoke Link"
                                >
                                  <Ban className="w-3 h-3" /> Revoke
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STEP 2: SHARE RESULT / SHARE SHEET */
            generatedShare && (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {shareMode === 'DIRECT' ? (
                  /* DIRECT SHARE PANEL */
                  <div className="space-y-4">
                    {/* Share Link Banner */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/50 border border-teal-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Secure Temporary Link Active
                        </div>
                        <span className="text-xs text-cyan-300 font-mono font-bold">
                          {getDurationSummary()}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white">{doc.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Anyone with this secure link can access this document according to your permissions ({getPermissionLabel(permissionOption)}).
                        </p>
                      </div>

                      {/* Link Box */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
                        <input
                          type="text"
                          readOnly
                          value={generatedShare.publicShareUrl}
                          className="bg-transparent flex-1 text-teal-300 outline-none select-all px-2 text-xs truncate"
                        />
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedLink ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Primary Action: Copy Secure Link & Native Share */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-extrabold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-950/50 transition-all cursor-pointer hover:scale-[1.01]"
                      >
                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                        <span>{copiedLink ? 'Secure Link Copied to Clipboard!' : '🔗 Copy Secure Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-all cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-teal-400" />
                        <span>📤 Share Link</span>
                      </button>
                    </div>

                    {/* Quick App Sharing Shortcuts */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Quick Share via Apps
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Email */}
                        <a
                          href={`mailto:?subject=${encodeURIComponent(`Secure Document: ${doc.title}`)}&body=${encodeURIComponent(`A secure document has been shared with you via MySpace.\n\nDocument: ${doc.title}\nPermission: ${getPermissionLabel(permissionOption)}\nExpiry: ${getDurationSummary()}\n\nAccess Link: ${generatedShare.publicShareUrl}${generatedShare.otpCode ? `\nOne-Time Passcode (OTP): ${generatedShare.otpCode}` : ''}${sharingPassword ? `\nPassword: ${sharingPassword}` : ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-semibold transition-colors cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-rose-400" />
                          <span>Email</span>
                        </a>

                        {/* WhatsApp */}
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`*Secure Document Shared via MySpace*\nDocument: ${doc.title}\nAccess Link: ${generatedShare.publicShareUrl}${generatedShare.otpCode ? `\nOTP: ${generatedShare.otpCode}` : ''}${sharingPassword ? `\nPassword: ${sharingPassword}` : ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-semibold transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Messages / SMS */}
                        <a
                          href={`sms:?&body=${encodeURIComponent(`Secure document "${doc.title}": ${generatedShare.publicShareUrl}${generatedShare.otpCode ? ` (OTP: ${generatedShare.otpCode})` : ''}`)}`}
                          className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-semibold transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4 text-cyan-400" />
                          <span>Messages</span>
                        </a>
                      </div>
                    </div>

                    {/* Password / OTP Details Card if enabled */}
                    {(generatedShare.otpCode || (requirePassword && sharingPassword)) && (
                      <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          Recipient Verification Credentials
                        </div>
                        <p className="text-[11px] text-amber-200/80">
                          Provide these verification details to the recipient so they can unlock the document:
                        </p>

                        {generatedShare.otpCode && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-amber-500/30 font-mono text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px] block">6-Digit OTP</span>
                              <strong className="text-white text-sm tracking-widest">{generatedShare.otpCode}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyOtp}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {copiedOtp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedOtp ? 'Copied' : 'Copy OTP'}
                            </button>
                          </div>
                        )}

                        {requirePassword && sharingPassword && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-amber-500/30 font-mono text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px] block">Sharing Password</span>
                              <strong className="text-white text-sm tracking-wider">{sharingPassword}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyPassword}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {copiedPassword ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedPassword ? 'Copied' : 'Copy Password'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Secondary Actions & QR Code view toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShareMode('QR')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>▣ View QR Code</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenPublicView(generatedShare.token);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Recipient Page</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={revoking || generatedShare.status === 'REVOKED'}
                        onClick={handleRevokeShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{generatedShare.status === 'REVOKED' ? 'Link Revoked' : 'Revoke Link'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* QR CODE SHOWCASE PANEL */
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-6">
                      {/* High Resolution QR Code Frame */}
                      <div className="relative p-3 rounded-2xl bg-white shadow-2xl shrink-0 flex flex-col items-center">
                        <img
                          src={generatedShare.qrCodeDataUrl}
                          alt="Encrypted MySpace QR Code"
                          className="w-48 h-48 rounded-lg"
                        />
                        <div className="mt-2 text-[10px] font-bold text-slate-800 font-mono tracking-widest flex items-center gap-1">
                          <Lock className="w-3 h-3 text-teal-600" /> MYSPACE ENCRYPTED
                        </div>
                      </div>

                      {/* Share Parameters */}
                      <div className="flex-1 space-y-2 text-xs text-center sm:text-left">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Encrypted QR Code Active
                        </div>

                        <h3 className="text-base font-bold text-white">{doc.title}</h3>

                        <div className="space-y-1 text-slate-400 font-mono text-xs">
                          <div><span className="text-slate-500">Permission:</span> <span className="text-teal-300 font-bold">{getPermissionLabel(permissionOption)}</span></div>
                          <div><span className="text-slate-500">Duration:</span> <span className="text-cyan-300 font-bold">{getDurationSummary()}</span></div>
                          <div><span className="text-slate-500">Verification:</span> <span className="text-emerald-300 font-bold">{generatedShare.recipientVerification}</span></div>
                          {generatedShare.otpCode && (
                            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-bold mt-1">
                              Recipient OTP: <span className="text-white tracking-widest">{generatedShare.otpCode}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400 break-all mt-2">
                          Token: {generatedShare.token}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-colors cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Secure Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-teal-400" />
                        <span>Share</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadQr}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Download QR Image PNG"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPublicView(generatedShare.token);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Test Link</span>
                      </button>
                    </div>

                    {/* Revoke & Switch back to direct */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <button
                        type="button"
                        disabled={revoking || generatedShare.status === 'REVOKED'}
                        onClick={handleRevokeShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{generatedShare.status === 'REVOKED' ? 'Access Revoked' : 'Revoke Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShareMode('DIRECT')}
                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors cursor-pointer"
                      >
                        Switch to Direct Link Details →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        {step === 'SETTINGS' && (
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmAndGenerate}
              disabled={isGenerating || (requirePassword && !sharingPassword)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 via-teal-400 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 shadow-lg shadow-teal-950/40 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Secure Link...</span>
                </>
              ) : shareMode === 'DIRECT' ? (
                <>
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                  <span>Generate Secure Link</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm & Generate QR</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
