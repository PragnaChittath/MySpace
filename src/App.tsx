import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { DashboardView } from './components/DashboardView.js';
import { HiddenSpaceView } from './components/HiddenSpaceView.js';
import { ActiveSharesView } from './components/ActiveSharesView.js';
import { AuditLogsView } from './components/AuditLogsView.js';
import { PublicShareView } from './components/PublicShareView.js';
import { UploadNewModal } from './components/UploadNewModal.js';
import { DocumentViewerModal } from './components/DocumentViewerModal.js';
import { EditDocumentModal } from './components/EditDocumentModal.js';
import { QrShareModal } from './components/QrShareModal.js';
import { QrScannerModal } from './components/QrScannerModal.js';
import { BulkExportModal } from './components/BulkExportModal.js';
import { AuthMfaModal } from './components/AuthMfaModal.js';
import { FaceRegistrationModal } from './components/FaceRegistrationModal.js';
import { FaceVerificationModal } from './components/FaceVerificationModal.js';
import { FaceTestModal } from './components/FaceTestModal.js';
import { SecuritySettingsModal } from './components/SecuritySettingsModal.js';
import { LanguageSelectorModal } from './components/LanguageSelectorModal.js';
import { MultiPersonProfilesModal } from './components/MultiPersonProfilesModal.js';
import {
  VaultDocument,
  ShareLink,
  AuditLog,
  User,
  NavigationTab,
  PersonProfile
} from './types.js';
import { api } from './services/api.js';
import {
  Clock,
  CheckCircle2,
  X,
  Lock,
  Sparkles
} from 'lucide-react';
import { formatDate } from './utils/formatters.js';

export default function App() {
  // Navigation & User state
  const [currentTab, setCurrentTab] = useState<NavigationTab>('vault');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setAuthToken] = useState<string | null>(null);

  // Main data states
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Offline capability state (safely initialized)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false) || api.isOfflineMode());

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForEdit, setSelectedDocForEdit] = useState<VaultDocument | null>(null);
  const [selectedDocForView, setSelectedDocForView] = useState<VaultDocument | null>(null);
  const [selectedDocForQr, setSelectedDocForQr] = useState<VaultDocument | null>(null);
  const [shareModalMode, setShareModalMode] = useState<'DIRECT' | 'QR'>('DIRECT');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isMultiProfilesOpen, setIsMultiProfilesOpen] = useState(false);

  // Facial Recognition Modals
  const [isFaceRegistrationOpen, setIsFaceRegistrationOpen] = useState(false);
  const [isFaceVerificationOpen, setIsFaceVerificationOpen] = useState(false);
  const [isFaceTestOpen, setIsFaceTestOpen] = useState(false);
  const [isSecuritySettingsOpen, setIsSecuritySettingsOpen] = useState(false);

  // Pending biometric auth flow metadata
  const [pendingFaceVerification, setPendingFaceVerification] = useState<{
    userId: string;
    userName: string;
    fallbackOtp: string;
  } | null>(null);
  const [, setPendingRegistrationUser] = useState<{
    user: User;
    token: string;
  } | null>(null);

  // Public QR Receiver View state (for receiver simulation / opened tokens)
  const [publicShareToken, setPublicShareToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const match = window.location.pathname.match(/^\/share\/([^/?#]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  });

  // Reminders / alerts dismissal
  const [dismissReminder, setDismissReminder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hidden Space states
  const [isHiddenSpaceOpen, setIsHiddenSpaceOpen] = useState(false);
  const [isRevealingSpace, setIsRevealingSpace] = useState(false);
  const [hiddenDocuments, setHiddenDocuments] = useState<VaultDocument[]>([]);
  const [loadingHidden, setLoadingHidden] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      api.setSimulatedOffline(false);
      loadAppData(currentUser?.id);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  // Initial load & sync (Session check: if user is not signed in on fresh app launch, immediately show Sign Up / Sign In)
  const loadAppData = async (userId?: string) => {
    setLoading(true);
    try {
      if (!userId) {
        setCurrentUser(null);
        setIsAuthModalOpen(true);
        setDocuments([]);
        setShares([]);
        setLogs([]);
        setLoading(false);
        return;
      }

      // 1. Get Me / Session
      const userRes = await api.getMe(userId).catch(() => null);
      if (userRes && userRes.user) {
        setCurrentUser(userRes.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('myspace_active_user_id', userRes.user.id);
        }
      } else {
        // Session invalid or user not found -> Prompt Sign Up / Sign In
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('myspace_active_user_id');
        }
        setIsAuthModalOpen(true);
        setDocuments([]);
        setShares([]);
        setLogs([]);
        setLoading(false);
        return;
      }

      // 2. Load documents
      const docsData = await api.getDocuments(userId).catch(() => []);
      setDocuments(Array.isArray(docsData) ? docsData : []);

      // 3. Load active shares
      const sharesData = await api.getShares(userId).catch(() => []);
      setShares(Array.isArray(sharesData) ? sharesData : []);

      // 4. Load security audit logs
      const logsData = await api.getAuditLogs().catch(() => []);
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      console.error('Error loading vault state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('myspace_active_user_id') : null;
    if (savedUserId) {
      loadAppData(savedUserId);
    } else {
      // User is not signed in on fresh launch -> Immediately open Sign Up / Sign In modal
      setCurrentUser(null);
      setIsAuthModalOpen(true);
      setLoading(false);
    }
  }, []);

  const handleSelectProfile = async (profile: PersonProfile) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('myspace_active_user_id', profile.id);
    }
    // Clear any active open document from previous person
    setSelectedDocForView(null);
    setSelectedDocForEdit(null);
    setSelectedDocForQr(null);

    showToast(`Switched to ${profile.name}'s dedicated vault`);
    await loadAppData(profile.id);
  };

  // Expiry notifications finder (Documents expiring in next 45 days)
  const expiringDocs = (Array.isArray(documents) ? documents : []).filter(doc => {
    if (!doc || !doc.expiryDate) return false;
    const exp = new Date(doc.expiryDate).getTime();
    const now = Date.now();
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= (doc.reminderDaysBefore || 45);
  });

  const handleSwitchUserByEmail = async (email: string) => {
    try {
      const loginRes = await api.login({ email });
      if ((loginRes as any).requiresFaceAuth) {
        setPendingFaceVerification({
          userId: loginRes.userId,
          userName: (loginRes as any).name || 'User',
          fallbackOtp: (loginRes as any).sampleOtp || ''
        });
        setIsFaceVerificationOpen(true);
      } else if (loginRes.requiresMfa) {
        const verifyRes = await api.verifyMfa({
          userId: loginRes.userId,
          otpCode: loginRes.sampleOtp || '999999'
        });
        setCurrentUser(verifyRes.user);
        setAuthToken(verifyRes.token);
        showToast(`Logged in as ${verifyRes.user.name}`);
        loadAppData(verifyRes.user.id);
      } else if (loginRes.user) {
        setCurrentUser(loginRes.user);
        setAuthToken(loginRes.token || 'jwt_token');
        showToast(`Logged in as ${loginRes.user.name}`);
        loadAppData(loginRes.user.id);
      }
    } catch (err: any) {
      showToast(`Login failed: ${err.message}`);
    }
  };

  const handleDocumentCreated = (newDoc: VaultDocument) => {
    setDocuments(prev => [newDoc, ...prev]);
    showToast(`Document "${newDoc.title}" encrypted with AES-256-GCM and saved.`);
    loadAppData(currentUser?.id);
  };

  const handleDocumentsBatchCreated = (newDocs: VaultDocument[]) => {
    setDocuments(prev => [...newDocs, ...prev]);
    showToast(`${newDocs.length} files encrypted with AES-256-GCM and saved to vault.`);
    loadAppData(currentUser?.id);
  };

  const handleDocumentUpdated = (updatedDoc: VaultDocument) => {
    setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    showToast(`"${updatedDoc.title}" updated successfully.`);
    loadAppData(currentUser?.id);
  };

  const handleDocumentDeleted = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setHiddenDocuments(prev => prev.filter(d => d.id !== docId));
      showToast('Document securely deleted and associated shares revoked.');
      loadAppData(currentUser?.id);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`);
    }
  };

  // Hidden Space Handlers
  const loadHiddenDocs = async (userId?: string) => {
    setLoadingHidden(true);
    try {
      const docs = await api.getHiddenDocuments(userId);
      setHiddenDocuments(Array.isArray(docs) ? docs : []);
    } catch (err: any) {
      console.error('Failed to load hidden documents:', err);
      showToast('Could not load private space: ' + (err.message || 'Error'));
    } finally {
      setLoadingHidden(false);
    }
  };

  const handleRevealHiddenSpace = async () => {
    // 1. Trigger brief, high-polish reveal animation
    setIsRevealingSpace(true);
    setPublicShareToken(null);

    // 2. Fetch hidden records in background
    const loadPromise = loadHiddenDocs(currentUser?.id);

    // 3. Short, premium reveal transition (~650ms) before rendering HiddenSpaceView
    setTimeout(async () => {
      setIsHiddenSpaceOpen(true);
      setIsRevealingSpace(false);
      showToast('✨ Welcome to your private space');
      await loadPromise;
    }, 650);
  };

  const handleExitHiddenSpace = () => {
    setIsHiddenSpaceOpen(false);
    showToast('Returned to main vault.');
    loadAppData(currentUser?.id);
  };

  const handleHideDocument = async (doc: VaultDocument) => {
    try {
      await api.hideDocument(doc.id);
      showToast(`“${doc.title}” moved to your private Hidden Space.`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      loadAppData(currentUser?.id);
    } catch (err: any) {
      showToast(`Failed to hide item: ${err.message}`);
    }
  };

  const handleUnhideDocument = async (doc: VaultDocument) => {
    try {
      await api.unhideDocument(doc.id);
      showToast(`“${doc.title}” restored to main vault.`);
      setHiddenDocuments(prev => prev.filter(d => d.id !== doc.id));
      await loadHiddenDocs(currentUser?.id);
      await loadAppData(currentUser?.id);
    } catch (err: any) {
      showToast(`Failed to restore item: ${err.message}`);
    }
  };

  const handleShareCreated = (newShare: ShareLink) => {
    setShares(prev => [newShare, ...prev]);
    showToast(`Time-limited QR token created (${newShare.durationMinutes} min expiry).`);
    loadAppData(currentUser?.id);
  };

  const handleOpenPublicView = (token: string) => {
    setPublicShareToken(token);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Face Registration completed callback
  const handleFaceRegistrationSuccess = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setIsFaceRegistrationOpen(false);
    showToast('Facial Recognition biometric profile successfully encrypted & activated!');
    loadAppData(updatedUser.id);
  };

  // Face Verification successful callback
  const handleFaceVerificationSuccess = (authData: { user: User; token: string; similarity: number }) => {
    setCurrentUser(authData.user);
    setAuthToken(authData.token);
    setIsFaceVerificationOpen(false);
    setPendingFaceVerification(null);
    showToast(`Biometric match verified (${authData.similarity}% match). Welcome back, ${authData.user.name}!`);
    loadAppData(authData.user.id);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-300 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-blue-500/40 shadow-2xl text-blue-200 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={tab => {
          setIsHiddenSpaceOpen(false);
          setPublicShareToken(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenLanguage={() => setIsLanguageModalOpen(true)}
        onOpenScanQr={() => setIsScannerOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenBulkExport={() => setIsBulkExportOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSecuritySettings={() => setIsSecuritySettingsOpen(true)}
        onSwitchUser={handleSwitchUserByEmail}
        onLogout={() => {
          setIsHiddenSpaceOpen(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('myspace_active_user_id');
          }
          setCurrentUser(null);
          setDocuments([]);
          setShares([]);
          setLogs([]);
          showToast('Logged out successfully.');
          setIsAuthModalOpen(true);
        }}
        documents={documents}
        onRevealHiddenSpace={handleRevealHiddenSpace}
        isInHiddenSpace={isHiddenSpaceOpen}
        onExitHiddenSpace={handleExitHiddenSpace}
        onOpenMultiProfiles={() => setIsMultiProfilesOpen(true)}
      />

      {/* Expiry Reminders Banner */}
      {!dismissReminder && expiringDocs.length > 0 && !publicShareToken && !isHiddenSpaceOpen && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-3 sm:p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white">Document Expiry Notice: </span>
                <span>
                  {expiringDocs[0].title} is due to expire on{' '}
                  <span className="font-semibold text-amber-300">{formatDate(expiringDocs[0].expiryDate)}</span>.
                  {expiringDocs.length > 1 && ` (+${expiringDocs.length - 1} other record)`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedDocForView(expiringDocs[0]);
                }}
                className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium border border-amber-500/30 cursor-pointer"
              >
                Inspect
              </button>
              <button
                onClick={() => setDismissReminder(true)}
                className="p-1 text-amber-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {publicShareToken ? (
          /* Public Receiver View Simulator */
          <PublicShareView
            token={publicShareToken}
            onBackToVault={() => setPublicShareToken(null)}
          />
        ) : isHiddenSpaceOpen ? (
          /* Secret Unlocked Hidden Space View */
          <HiddenSpaceView
            hiddenDocuments={hiddenDocuments}
            isLoading={loadingHidden}
            onExitHiddenSpace={handleExitHiddenSpace}
            onUnhideDocument={handleUnhideDocument}
            onViewDocument={doc => setSelectedDocForView(doc)}
            onDeleteDocument={handleDocumentDeleted}
          />
        ) : (
          /* Standard Authenticated Tab Views */
          <>
            {currentTab === 'vault' && (
              <DashboardView
                currentUser={currentUser}
                documents={documents}
                onViewDocument={doc => setSelectedDocForView(doc)}
                onEditDocument={doc => setSelectedDocForEdit(doc)}
                onPlayAudio={doc => setSelectedDocForView(doc)}
                onGenerateQr={doc => {
                  setShareModalMode('QR');
                  setSelectedDocForQr(doc);
                }}
                onShareDirect={doc => {
                  setShareModalMode('DIRECT');
                  setSelectedDocForQr(doc);
                }}
                onDeleteDocument={handleDocumentDeleted}
                onHideDocument={handleHideDocument}
                onRefresh={() => loadAppData(currentUser?.id)}
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenBulkExport={() => setIsBulkExportOpen(true)}
                onOpenMultiProfiles={() => setIsMultiProfilesOpen(true)}
                onShareGeneral={mode => {
                  setShareModalMode(mode);
                  if (documents.length > 0) {
                    setSelectedDocForQr(documents[0]);
                  } else {
                    setSelectedDocForQr(null);
                  }
                }}
                onOpenSecuritySettings={() => setIsSecuritySettingsOpen(true)}
                isLoading={loading}
              />
            )}

            {currentTab === 'shares' && (
              <ActiveSharesView
                currentUser={currentUser}
                shares={shares}
                onRefresh={() => loadAppData(currentUser?.id)}
                onOpenPublicView={handleOpenPublicView}
              />
            )}

            {currentTab === 'audit' && (
              <AuditLogsView logs={logs} onRefresh={() => loadAppData(currentUser?.id)} />
            )}
          </>
        )}
      </main>

      {/* Application Footer */}
      <footer className="border-t border-slate-800 bg-[#0B1120] py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold text-slate-300">MySpace Secure Digital Document Vault</span>
            <span className="text-[10px] text-slate-500">• AES-256-GCM + Facial Biometrics + Time-Limited QR Sharing</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
            <span>AEAD GCM: 128-Bit Tag</span>
            <span>•</span>
            <span>PBKDF2 + Biometric Cosine</span>
            <span>•</span>
            <span className="text-emerald-400">STATUS: OPERATIONAL</span>
          </div>
        </div>
      </footer>

      {/* Magic Reveal Transition Screen */}
      {isRevealingSpace && (
        <div
          id="magic-reveal-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
        >
          <div className="flex flex-col items-center text-center p-6 space-y-4 max-w-sm animate-in zoom-in-95 duration-200">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 blur-xl opacity-70 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/40 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/50">
                <Sparkles className="w-8 h-8 text-amber-300 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Welcome to your private space ✨
              </h2>
              <p className="text-xs text-indigo-200">
                Opening your private records…
              </p>
            </div>
            <div className="w-44 h-1 bg-slate-800/80 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Standard Modals */}
      <UploadNewModal
        currentUser={currentUser}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleDocumentCreated}
        onBatchUploadSuccess={handleDocumentsBatchCreated}
      />

      <EditDocumentModal
        document={selectedDocForEdit}
        isOpen={!!selectedDocForEdit}
        onClose={() => setSelectedDocForEdit(null)}
        onSuccess={handleDocumentUpdated}
      />

      <DocumentViewerModal
        document={selectedDocForView}
        isOpen={!!selectedDocForView}
        onClose={() => setSelectedDocForView(null)}
        onGenerateQr={doc => {
          setSelectedDocForView(null);
          setShareModalMode('QR');
          setSelectedDocForQr(doc);
        }}
        onShareDirect={doc => {
          setSelectedDocForView(null);
          setShareModalMode('DIRECT');
          setSelectedDocForQr(doc);
        }}
      />

      <QrShareModal
        document={selectedDocForQr}
        isOpen={!!selectedDocForQr}
        initialMode={shareModalMode}
        onClose={() => setSelectedDocForQr(null)}
        onShareCreated={handleShareCreated}
        onOpenPublicView={handleOpenPublicView}
      />

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectToken={handleOpenPublicView}
        availableShares={shares}
      />

      {/* Bulk Vault Export Modal */}
      <BulkExportModal
        currentUser={currentUser}
        documents={documents}
        isOpen={isBulkExportOpen}
        onClose={() => setIsBulkExportOpen(false)}
        onExportSuccess={(result) => {
          showToast(`Archive "${result.fileName}" downloaded successfully!`);
          loadAppData(currentUser?.id);
        }}
      />

      {/* Auth & MFA Modal */}
      <AuthMfaModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          showToast(`Authenticated as ${user.name}`);
          loadAppData(user.id);
        }}
        onOpenFaceVerification={(userId, userName, fallbackOtp) => {
          setPendingFaceVerification({ userId, userName, fallbackOtp });
          setIsFaceVerificationOpen(true);
        }}
        onOpenFaceRegistration={(user, token) => {
          setPendingRegistrationUser({ user, token });
          setCurrentUser(user);
          setAuthToken(token);
          setIsFaceRegistrationOpen(true);
        }}
      />

      {/* Facial Registration Modal (Sign Up -> Password Setup -> Face Registration -> Account Created) */}
      {currentUser && (
        <FaceRegistrationModal
          userId={currentUser.id}
          isOpen={isFaceRegistrationOpen}
          onClose={() => setIsFaceRegistrationOpen(false)}
          onSuccess={handleFaceRegistrationSuccess}
        />
      )}

      {/* Facial Verification Modal (Returning User -> Login -> Face Verification -> Dashboard) */}
      {pendingFaceVerification && (
        <FaceVerificationModal
          userId={pendingFaceVerification.userId}
          userName={pendingFaceVerification.userName}
          isOpen={isFaceVerificationOpen}
          onSuccess={handleFaceVerificationSuccess}
          onFallbackToMfa={() => {
            setIsFaceVerificationOpen(false);
            setIsAuthModalOpen(true);
          }}
          onClose={() => {
            setIsFaceVerificationOpen(false);
            setPendingFaceVerification(null);
          }}
        />
      )}

      {/* Facial Biometric Live Diagnostic Test */}
      {currentUser && (
        <FaceTestModal
          userId={currentUser.id}
          isOpen={isFaceTestOpen}
          onClose={() => setIsFaceTestOpen(false)}
        />
      )}

      {/* Security & Biometric Settings Modal */}
      {currentUser && (
        <SecuritySettingsModal
          user={currentUser}
          isOpen={isSecuritySettingsOpen}
          onClose={() => setIsSecuritySettingsOpen(false)}
          onOpenFaceRegistration={() => {
            setIsSecuritySettingsOpen(false);
            setIsFaceRegistrationOpen(true);
          }}
          onOpenFaceTest={() => {
            setIsFaceTestOpen(true);
          }}
          onUserUpdated={updatedUser => {
            setCurrentUser(updatedUser);
            loadAppData(updatedUser.id);
          }}
        />
      )}

      {/* Multilingual Selector Modal */}
      <LanguageSelectorModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
      />

      {/* Multi-Person Profiles Management Modal */}
      <MultiPersonProfilesModal
        isOpen={isMultiProfilesOpen}
        onClose={() => setIsMultiProfilesOpen(false)}
        currentUser={currentUser}
        onSelectProfile={handleSelectProfile}
        onProfileAdded={(newProfile) => {
          showToast(`Profile created for ${newProfile.name}`);
        }}
        onProfileDeleted={(deletedId) => {
          showToast('Profile and associated vault records deleted');
          if (currentUser?.id === deletedId) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('myspace_active_user_id');
            }
            loadAppData();
          }
        }}
      />
    </div>
  );
}
