import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Lock,
  EyeOff,
  QrCode,
  FileText,
  Activity,
  UserCheck,
  User as UserIcon,
  Upload,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Plus,
  ScanFace,
  ShieldCheck,
  Database,
  Download,
  FileArchive,
  Globe,
  Users
} from 'lucide-react';
import { User, VaultDocument, NavigationTab } from '../types.js';
import { getExpiryStatus } from '../utils/formatters.js';
import { useTranslation } from '../i18n/LanguageContext.js';

interface NavbarProps {
  currentUser: User | null;
  currentTab?: NavigationTab | string;
  activeTab?: string;
  onSelectTab?: (tab: NavigationTab) => void;
  setActiveTab?: (tab: string) => void;
  onOpenUpload: () => void;
  onOpenLanguage?: () => void;
  onOpenScanQr?: () => void;
  onOpenScanner?: () => void;
  onOpenBulkExport?: () => void;
  onOpenAuthModal?: () => void;
  onOpenSecuritySettings?: () => void;
  onSwitchUser?: (userEmail: string) => void;
  onLogout?: () => void;
  darkMode?: boolean;
  setDarkMode?: (val: boolean | ((prev: boolean) => boolean)) => void;
  documents?: VaultDocument[];
  onRevealHiddenSpace?: () => void;
  isInHiddenSpace?: boolean;
  onExitHiddenSpace?: () => void;
  onOpenMultiProfiles?: () => void;
}

export function Navbar({
  currentUser,
  currentTab = 'vault',
  activeTab,
  onSelectTab,
  setActiveTab,
  onOpenUpload,
  onOpenLanguage,
  onOpenScanQr,
  onOpenScanner,
  onOpenBulkExport,
  onOpenAuthModal,
  onOpenSecuritySettings,
  onLogout,
  documents = [],
  onRevealHiddenSpace,
  isInHiddenSpace = false,
  onExitHiddenSpace,
  onOpenMultiProfiles
}: NavbarProps) {
  const { t, currentLanguage } = useTranslation();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  // 3-second Magic Reveal long-press state & refs
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHoldingLogo, setIsHoldingLogo] = useState(false);
  const holdStartTimeRef = useRef<number>(0);
  const holdAnimFrameRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const hasRevealedRef = useRef<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Multi-Person Profiles Long-Press State & Refs (Hold top profile button >= 500ms)
  const profileLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const profileLongPressTriggeredRef = useRef<boolean>(false);
  const [isPressingProfile, setIsPressingProfile] = useState<boolean>(false);

  const startProfileLongPress = () => {
    profileLongPressTriggeredRef.current = false;
    setIsPressingProfile(true);
    profileLongPressTimerRef.current = setTimeout(() => {
      profileLongPressTriggeredRef.current = true;
      setIsPressingProfile(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      if (onOpenMultiProfiles) {
        onOpenMultiProfiles();
      }
    }, 500);
  };

  const cancelProfileLongPress = () => {
    if (profileLongPressTimerRef.current) {
      clearTimeout(profileLongPressTimerRef.current);
      profileLongPressTimerRef.current = null;
    }
    setIsPressingProfile(false);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    if (profileLongPressTriggeredRef.current) {
      profileLongPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setShowPersonaMenu(prev => !prev);
    setShowNotificationMenu(false);
  };

  const activeTabValue = (activeTab || currentTab || 'vault') as NavigationTab;
  const handleTabChange = (tab: NavigationTab) => {
    if (isInHiddenSpace && onExitHiddenSpace) {
      onExitHiddenSpace();
    }
    if (onSelectTab) onSelectTab(tab);
    if (setActiveTab) setActiveTab(tab);
  };

  const handleScanClick = () => {
    if (onOpenScanQr) onOpenScanQr();
    else if (onOpenScanner) onOpenScanner();
  };

  // Compute expiring alerts
  const safeDocs = Array.isArray(documents) ? documents.filter(Boolean) : [];
  const expiringDocs = safeDocs.filter(d => {
    if (!d || !d.expiryDate) return false;
    const st = getExpiryStatus(d.expiryDate);
    return st.status === 'EXPIRING_SOON' || st.status === 'EXPIRED';
  });

  // Lifecycle cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (holdAnimFrameRef.current) {
        cancelAnimationFrame(holdAnimFrameRef.current);
        holdAnimFrameRef.current = null;
      }
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, []);

  const cancelHold = (isSuccess = false) => {
    if (holdAnimFrameRef.current) {
      cancelAnimationFrame(holdAnimFrameRef.current);
      holdAnimFrameRef.current = null;
    }
    isHoldingRef.current = false;
    if (!isSuccess) {
      setIsHoldingLogo(false);
      setHoldProgress(0);
      hasRevealedRef.current = false;
    }
  };

  // Reliable 3-Second Pointer Down Handler (Mouse + Touch + Pen)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button (left-click) or touch
    if (e.button !== 0) return;

    // If already in Hidden Space, user can click to return to vault
    if (isInHiddenSpace) {
      return;
    }

    // Clean up any stale state
    cancelHold(false);

    pointerIdRef.current = e.pointerId;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    holdStartTimeRef.current = Date.now();
    isHoldingRef.current = true;
    hasRevealedRef.current = false;
    setIsHoldingLogo(true);
    setHoldProgress(0);

    // Capture pointer so micro-drifts and DOM re-renders do not drop the gesture
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for environments where pointer capture isn't supported
    }

    const DURATION = 3000; // Exact 3.0 seconds

    const updateHoldLoop = () => {
      if (!isHoldingRef.current || hasRevealedRef.current) return;

      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(1, elapsed / DURATION);
      setHoldProgress(progress);

      if (progress >= 1) {
        // 3.0 seconds successfully held!
        hasRevealedRef.current = true;
        isHoldingRef.current = false;
        if (holdAnimFrameRef.current) {
          cancelAnimationFrame(holdAnimFrameRef.current);
          holdAnimFrameRef.current = null;
        }

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([40, 60, 80]);
          } catch {}
        }

        // Execute Magic Reveal
        if (isMountedRef.current && onRevealHiddenSpace) {
          onRevealHiddenSpace();
        }

        // Reset visual hold state after brief moment so user sees 100% completion
        revealTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            setIsHoldingLogo(false);
            setHoldProgress(0);
          }
        }, 450);
      } else {
        holdAnimFrameRef.current = requestAnimationFrame(updateHoldLoop);
      }
    };

    holdAnimFrameRef.current = requestAnimationFrame(updateHoldLoop);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isHoldingRef.current || hasRevealedRef.current) return;
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;

    // Movement distance check
    const dist = Math.hypot(e.clientX - startPointRef.current.x, e.clientY - startPointRef.current.y);
    if (dist > 25) {
      try {
        if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        }
      } catch {}
      pointerIdRef.current = null;
      cancelHold(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
        e.currentTarget.releasePointerCapture(pointerIdRef.current);
      }
    } catch {}
    pointerIdRef.current = null;

    // If hold reached 3 seconds, reveal already fired
    if (hasRevealedRef.current) {
      isHoldingRef.current = false;
      return;
    }

    if (isHoldingRef.current) {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const dist = Math.hypot(e.clientX - startPointRef.current.x, e.clientY - startPointRef.current.y);
      cancelHold(false);

      // Normal short click handling (< 350ms, minimal movement)
      if (elapsed > 10 && elapsed < 350 && dist < 15) {
        if (isInHiddenSpace && onExitHiddenSpace) {
          onExitHiddenSpace();
        } else {
          handleTabChange('vault');
        }
      }
    } else if (isInHiddenSpace) {
      if (onExitHiddenSpace) onExitHiddenSpace();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
        e.currentTarget.releasePointerCapture(pointerIdRef.current);
      }
    } catch {}
    pointerIdRef.current = null;

    if (hasRevealedRef.current) return;
    cancelHold(false);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    // If not captured and user moves out before 3s, cancel
    try {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        if (!hasRevealedRef.current && isHoldingRef.current) {
          cancelHold(false);
        }
      }
    } catch {
      if (!hasRevealedRef.current && isHoldingRef.current) {
        cancelHold(false);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-200 bg-[#0F172A] border-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Security Status */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative">
              <button
                id="brand-logo-btn"
                type="button"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerLeave}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isInHiddenSpace && onExitHiddenSpace) {
                      onExitHiddenSpace();
                    } else {
                      handleTabChange('vault');
                    }
                  }
                }}
                style={{
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  userSelect: 'none'
                }}
                className={`flex items-center gap-3 text-left focus:outline-none group cursor-pointer select-none touch-none transition-all duration-200 ${
                  isHoldingLogo ? 'scale-105' : 'hover:opacity-90'
                }`}
                title={
                  isInHiddenSpace
                    ? 'MySpace Hidden Space (Click to exit)'
                    : 'Press and hold for 3 seconds to unlock private space'
                }
              >
                {/* Logo Icon with Circular Progress and Soft Glow */}
                <div className="relative pointer-events-none">
                  {/* Soft Glow Halo when holding: begins small (0-1s), increases (1-2s), becomes stronger (2-3s) */}
                  {isHoldingLogo && (
                    <div
                      className="absolute -inset-2.5 rounded-2xl bg-gradient-to-r from-blue-500/40 via-indigo-500/60 to-purple-500/50 blur-md pointer-events-none transition-all duration-150"
                      style={{
                        opacity: holdProgress < 0.33 ? 0.35 : holdProgress < 0.66 ? 0.7 : 1.0,
                        transform: `scale(${1 + holdProgress * 0.15})`
                      }}
                    />
                  )}

                  {/* SVG Circular Progress Ring */}
                  {isHoldingLogo && (
                    <svg
                      className="absolute -inset-2 w-12 h-12 pointer-events-none -rotate-90 z-20"
                      viewBox="0 0 44 44"
                    >
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="rgba(99, 102, 241, 0.25)"
                        strokeWidth="3.5"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke={holdProgress >= 0.98 ? '#a855f7' : '#818cf8'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={113.1}
                        strokeDashoffset={113.1 * (1 - holdProgress)}
                        className="transition-all duration-75"
                      />
                    </svg>
                  )}

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm transition-all relative z-10 ${
                      isInHiddenSpace
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-700 shadow-indigo-500/30 ring-2 ring-indigo-400'
                        : isHoldingLogo
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 ring-2 ring-indigo-400'
                        : 'bg-blue-600 group-hover:bg-blue-500'
                    }`}
                  >
                    {isInHiddenSpace ? <Lock className="w-4 h-4 text-white" /> : 'MS'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold tracking-tight text-white flex items-center gap-1.5">
                      {t('nav.mySpace', 'MySpace')}
                      {isInHiddenSpace && (
                        <span className="text-indigo-400 text-xs font-normal">/ Hidden Space</span>
                      )}
                    </span>
                    {isInHiddenSpace ? (
                      <div className="flex items-center text-xs text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/40">
                        <Lock className="w-3 h-3 text-indigo-400 mr-1" />
                        Private Space
                      </div>
                    ) : (
                      <div className="hidden lg:flex items-center text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                        AES-256 Active
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Floating feedback tooltip during hold */}
              {isHoldingLogo && (
                <div className="absolute top-14 left-0 z-50 whitespace-nowrap px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl shadow-indigo-500/30 backdrop-blur-md flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-none select-none">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-white">
                      {holdProgress >= 0.66
                        ? 'Unlocking your private space…'
                        : 'Hold to reveal…'}
                    </span>
                    <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-400 transition-all duration-75 ease-linear rounded-full"
                        style={{ width: `${Math.round(holdProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-300 font-bold ml-1">
                    {Math.round(holdProgress * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Exit Hidden Space quick button if currently revealed */}
            {isInHiddenSpace && onExitHiddenSpace && (
              <button
                id="btn-navbar-exit-hidden"
                onClick={onExitHiddenSpace}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-medium transition-colors cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t('nav.privateSpace', 'Private Space')}</span>
              </button>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector (directly before Notifications) */}
            <button
              id="btn-navbar-language"
              onClick={onOpenLanguage}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              title="Select Language"
            >
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-sans font-medium text-xs max-w-[80px] sm:max-w-none truncate">
                {currentLanguage?.nativeName || 'Language'}
              </span>
            </button>

            {/* Notifications Popover */}
            <div className="relative">
              <button
                id="btn-notifications"
                onClick={() => {
                  setShowNotificationMenu(!showNotificationMenu);
                  setShowPersonaMenu(false);
                }}
                className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Expiry Reminders & Security Alerts"
              >
                <Bell className="w-4 h-4" />
                {expiringDocs.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-black text-slate-950 flex items-center justify-center ring-2 ring-slate-900 animate-bounce">
                    {expiringDocs.length}
                  </span>
                )}
              </button>

              {showNotificationMenu && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 text-slate-100 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      {t('notifications.title', 'Document Expiry Reminders')}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">{expiringDocs.length} {t('notifications.alerts', 'Alert(s)')}</span>
                  </div>

                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {expiringDocs.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        All documents are up-to-date with no pending expiries.
                      </div>
                    ) : (
                      expiringDocs.map(doc => {
                        const exp = getExpiryStatus(doc.expiryDate);
                        return (
                          <div
                            key={doc.id}
                            className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white truncate max-w-[160px]">{doc.title}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${exp.colorClass}`}>
                                {exp.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                              <span>ID: {doc.documentNumber || 'N/A'}</span>
                              <button
                                onClick={() => {
                                  setActiveTab('vault');
                                  setShowNotificationMenu(false);
                                }}
                                className="text-teal-400 hover:underline cursor-pointer"
                              >
                                View in Vault →
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Account Menu (Compact: Only human/profile icon or avatar, no name; Long-press to open Multi-Person Profiles) */}
            <div className="relative">
              {currentUser ? (
                <button
                  id="btn-persona-menu"
                  onClick={handleProfileClick}
                  onMouseDown={startProfileLongPress}
                  onMouseUp={cancelProfileLongPress}
                  onMouseLeave={cancelProfileLongPress}
                  onTouchStart={startProfileLongPress}
                  onTouchEnd={cancelProfileLongPress}
                  onTouchCancel={cancelProfileLongPress}
                  onContextMenu={e => e.preventDefault()}
                  className={`relative flex items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isPressingProfile
                      ? 'bg-blue-600/30 border-blue-500 ring-2 ring-blue-400 scale-95 duration-100'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                  }`}
                  title={`Account: ${currentUser?.name || 'User'}`}
                >
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser?.name || 'User'}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-teal-500/50 pointer-events-none"
                    />
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs pointer-events-none ${
                        currentUser?.avatarColor === 'purple'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : currentUser?.avatarColor === 'blue'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : currentUser?.avatarColor === 'emerald'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : currentUser?.avatarColor === 'amber'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : currentUser?.avatarColor === 'rose'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      }`}
                    >
                      {currentUser?.name ? (
                        <span>
                          {currentUser.name
                            .trim()
                            .split(/\s+/)
                            .map(p => p[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </span>
                      ) : (
                        <UserIcon className="w-4 h-4" />
                      )}
                    </div>
                  )}

                  {/* Visual holding ripple animation during long-press */}
                  {isPressingProfile && (
                    <span className="absolute -inset-1 rounded-2xl border-2 border-blue-400 animate-ping opacity-75 pointer-events-none" />
                  )}
                </button>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center justify-center p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer shadow-sm"
                  title={t('nav.signIn', 'Sign In')}
                >
                  <UserCheck className="w-4 h-4" />
                </button>
              )}

              {showPersonaMenu && currentUser && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 text-slate-100 animate-in fade-in zoom-in-95">
                  <div className="pb-2.5 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white truncate">{currentUser?.name}</div>
                      {currentUser?.relationship && !currentUser.relationship.includes('Primary') && currentUser.relationship !== 'Self' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                          {currentUser.relationship}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{currentUser?.email}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-teal-400 font-mono">
                        <Lock className="w-3 h-3" /> {t('nav.mfaActive', 'MFA Active')}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-medium">
                        {currentUser.faceAuthEnabled && currentUser.hasFaceBiometrics ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ScanFace className="w-3 h-3" /> {t('nav.faceIdActive', 'Face ID On')}
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1">
                            <ScanFace className="w-3 h-3 text-slate-500" /> {t('nav.faceIdOff', 'Face ID Off')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Person Profiles Quick Switcher */}
                  <div className="py-2 border-b border-slate-800 space-y-1">
                    {onOpenMultiProfiles && (
                      <button
                        id="btn-nav-multi-profiles"
                        onClick={() => {
                          setShowPersonaMenu(false);
                          onOpenMultiProfiles();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-xs font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-400" />
                          <span>Multi-Person Profiles</span>
                        </div>
                      </button>
                    )}

                    <button
                      id="btn-nav-security-settings"
                      onClick={() => {
                        setShowPersonaMenu(false);
                        if (onOpenSecuritySettings) onOpenSecuritySettings();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ScanFace className="w-4 h-4 text-blue-400" />
                        <span>{t('nav.securitySettings', 'Security & Face Recognition')}</span>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                        Settings
                      </span>
                    </button>

                    {onOpenBulkExport && (
                      <button
                        id="btn-nav-bulk-export"
                        onClick={() => {
                          setShowPersonaMenu(false);
                          onOpenBulkExport();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 text-blue-400" />
                          <span>{t('nav.bulkExport', 'Bulk Vault Export')}</span>
                        </div>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                          .ZIP
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setShowPersonaMenu(false);
                        if (onOpenAuthModal) onOpenAuthModal();
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {t('nav.switchAccount', 'Switch Account')}
                    </button>
                    <button
                      onClick={() => {
                        setShowPersonaMenu(false);
                        if (onLogout) onLogout();
                      }}
                      className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> {t('nav.logout', 'Log Out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
