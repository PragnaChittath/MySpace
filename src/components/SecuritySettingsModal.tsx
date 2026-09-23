import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ScanFace,
  Lock,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Sparkles,
  ExternalLink,
  Info,
  Sliders,
  Check,
  Gauge,
  Database,
  WifiOff,
  HardDrive
} from 'lucide-react';
import { User } from '../types.js';
import { api } from '../services/api.js';
import { offlineStorage, OfflineCacheStats } from '../services/offlineStorage.js';
import { formatDate, formatBytes } from '../utils/formatters.js';

interface SecuritySettingsModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onOpenFaceRegistration: () => void;
  onOpenFaceTest: () => void;
  onUserUpdated: (user: User) => void;
}

export function SecuritySettingsModal({
  user,
  isOpen,
  onClose,
  onOpenFaceRegistration,
  onOpenFaceTest,
  onUserUpdated
}: SecuritySettingsModalProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Offline Cache Management State
  const [cacheStats, setCacheStats] = useState<OfflineCacheStats | null>(null);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCacheStats();
    }
  }, [isOpen]);

  const loadCacheStats = async () => {
    try {
      const stats = await offlineStorage.getStats();
      setCacheStats(stats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncAllOffline = async () => {
    setIsSyncingOffline(true);
    setActionError(null);
    try {
      const docs = await api.getDocuments(user.id);
      await offlineStorage.saveDocuments(docs);
      await offlineStorage.saveUser(user);
      const updatedStats = await offlineStorage.getStats();
      setCacheStats(updatedStats);
      setActionSuccess(`Successfully encrypted & cached ${docs.length} documents for offline access!`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to cache documents offline');
    } finally {
      setIsSyncingOffline(false);
    }
  };

  const handlePurgeOfflineCache = async () => {
    if (!confirm('Purge all offline cached documents and local encryption keys from this browser?')) return;
    setIsPurgingCache(true);
    setActionError(null);
    try {
      await offlineStorage.clearAll();
      const updatedStats = await offlineStorage.getStats();
      setCacheStats(updatedStats);
      setActionSuccess('All offline encrypted data and keys were securely purged.');
    } catch (err: any) {
      setActionError(err.message || 'Failed to clear offline cache');
    } finally {
      setIsPurgingCache(false);
    }
  };

  if (!isOpen) return null;

  const handleToggleFaceAuth = async (enabled: boolean) => {
    setActionError(null);
    setActionSuccess(null);

    if (enabled && !user.hasFaceBiometrics) {
      onOpenFaceRegistration();
      return;
    }

    setIsToggling(true);
    try {
      const res = await api.toggleFaceAuth(user.id, enabled);
      onUserUpdated(res.user);
      setActionSuccess(
        enabled
          ? 'Facial Recognition authentication has been enabled for your account.'
          : 'Facial Recognition authentication is now disabled. MFA/OTP will be used for logins.'
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to update biometric status');
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteFaceBiometrics = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsDeleting(true);

    try {
      const res = await api.deleteFaceData(user.id);
      onUserUpdated(res.user);
      setShowDeleteConfirm(false);
      setActionSuccess('Facial biometric data permanently purged from the vault.');
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete facial data');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Security & Biometric Settings</h2>
              <p className="text-xs text-slate-400">Manage multi-factor auth and encrypted biometric sign-in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Alerts */}
          {actionSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Section: Facial Recognition Authentication */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Facial Recognition</h3>
                  <p className="text-xs text-slate-400">
                    Use your device camera with AI liveness detection for instant, seamless login
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {user.faceAuthEnabled && user.hasFaceBiometrics ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Enabled
                  </span>
                ) : user.hasFaceBiometrics ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Disabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Setup Required
                  </span>
                )}
              </div>
            </div>

            {/* Toggle switch & Action details */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-300">Enable Facial Sign-in</span>
                <p className="text-[11px] text-slate-500">
                  {user.hasFaceBiometrics
                    ? `Enrolled on ${user.faceRegisteredAt ? formatDate(user.faceRegisteredAt) : 'Recent'}`
                    : 'Enrolling your face creates an encrypted 128-d biometric template'}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!user.faceAuthEnabled}
                  disabled={isToggling}
                  onChange={(e) => handleToggleFaceAuth(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {user.hasFaceBiometrics ? (
                <>
                  <button
                    onClick={onOpenFaceRegistration}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                    Re-register Face
                  </button>

                  <button
                    onClick={onOpenFaceTest}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    Test Face Recognition
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    Delete Facial Data
                  </button>
                </>
              ) : (
                <button
                  onClick={onOpenFaceRegistration}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ScanFace className="w-4 h-4" />
                  Set Up Face Recognition
                </button>
              )}
            </div>

            {/* Delete Confirmation Box */}
            {showDeleteConfirm && (
              <div className="p-3.5 bg-red-950/60 border border-red-600/40 rounded-xl space-y-2.5 animate-in zoom-in-95">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Purge Facial Biometric Data?</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  This permanently removes your encrypted 128-d biometric template from the server. You can re-register anytime.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDeleteFaceBiometrics}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Confirm Purge
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Two-Factor / MFA Fallback Settings */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Multi-Factor OTP & Fallback</h3>
                  <p className="text-xs text-slate-400">
                    6-digit cryptographic TOTP challenge for login & biometric fallback
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                <Check className="w-3 h-3" />
                Active
              </span>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  MFA Secret Identifier
                </span>
                <p className="font-mono text-xs text-slate-200 mt-0.5">{user.mfaSecret || 'LV-MFA-SECURE'}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400">Fallback Protection</span>
                <p className="text-xs text-emerald-400 font-medium">Automatic on face lockout</p>
              </div>
            </div>
          </div>

          {/* Section: Encrypted Offline Storage & At-Rest Caching */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Encrypted Offline Cache (At Rest)</h3>
                  <p className="text-xs text-slate-400">
                    Client-side IndexedDB encrypted with WebCrypto AES-256-GCM + PBKDF2 device key
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-950/80 border border-teal-500/40 text-teal-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                AES-GCM at Rest
              </span>
            </div>

            {/* Offline Cache Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Cached Documents</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {cacheStats ? cacheStats.cachedDocsCount : '...'} files
                </span>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Encrypted Payload</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {cacheStats ? formatBytes(cacheStats.cachedBytes) : '...'}
                </span>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Last Cache Sync</span>
                <span className="text-xs font-mono text-slate-300 mt-1 block truncate">
                  {cacheStats && cacheStats.lastSyncedAt ? formatDate(cacheStats.lastSyncedAt) : 'Never'}
                </span>
              </div>
            </div>

            {/* Cache Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={handleSyncAllOffline}
                disabled={isSyncingOffline}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSyncingOffline ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {isSyncingOffline ? 'Encrypting & Storing...' : 'Pre-Cache All Documents Offline'}
              </button>

              <button
                onClick={handlePurgeOfflineCache}
                disabled={isPurgingCache}
                className="px-3.5 py-2 bg-slate-800 hover:bg-red-950/60 hover:border-red-800/40 border border-slate-700 text-slate-300 hover:text-red-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
              >
                {isPurgingCache ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Purge Offline Cache
              </button>
            </div>
          </div>

          {/* Biometric Privacy & Security Details */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              Zero-Knowledge Biometric Architecture
            </h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-slate-300">No Raw Photos:</strong> Images never leave device memory. Only irreversible 128-dimensional unit mathematical vectors are stored.
              </li>
              <li>
                <strong className="text-slate-300">AES-256-GCM AEAD:</strong> Stored templates are encrypted at rest with PBKDF2 user salts and authenticated tags.
              </li>
              <li>
                <strong className="text-slate-300">Anti-Spoofing Liveness:</strong> Active eye-blink and head yaw rotation challenges prevent photo and replay attacks.
              </li>
              <li>
                <strong className="text-slate-300">Rate Limiting:</strong> 5 failed attempts trigger an automatic 15-minute lock and fallback to Password + OTP.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
