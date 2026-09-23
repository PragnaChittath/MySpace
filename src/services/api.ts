import {
  VaultDocument,
  ShareLink,
  AuditLog,
  User,
  DocumentCategory,
  SensitivityLevel,
  SharePermission,
  CreateSharePayload,
  WatermarkConfig,
  PersonProfile,
  CreatePersonProfilePayload
} from '../types.js';
import { offlineStorage, OfflineCacheStats } from './offlineStorage.js';

export interface LoginResponse {
  mfaRequired: boolean;
  userId: string;
  email: string;
  generatedOtp: string;
  expiresAt: number;
  message: string;
}

export interface MfaVerifyResponse {
  token: string;
  user: User;
}

export interface PublicShareResponse {
  success?: boolean;
  requiresVerification?: boolean;
  verificationType?: 'NONE' | 'OTP' | 'EMAIL' | 'PHONE' | 'PIN';
  requiresPasscode?: boolean;
  requiresOtp?: boolean;
  documentTitle?: string;
  passcodeHint?: string;
  simulatedOtpHint?: string;
  recipientIdentifier?: string;
  expired?: boolean;
  status?: string;
  message?: string;
  isMultiFile?: boolean;
  totalFiles?: number;
  files?: Array<{
    documentId: string;
    documentTitle: string;
    documentCategory?: DocumentCategory;
    documentNumber?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    durationMinutes?: number;
    expiresAt?: string;
    permission?: SharePermission;
    allowDownload?: boolean;
    requiresPasscode?: boolean;
    passcodeHint?: string;
    requiresOtp?: boolean;
    simulatedOtpHint?: string;
    status?: string;
  }>;
  document?: {
    title: string;
    category: DocumentCategory;
    documentNumber?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    issueDate?: string;
    expiryDate?: string;
    verifiedIssuer?: string;
    ownerName: string;
    decryptedContent: string;
  };
  shareInfo?: {
    permission: SharePermission;
    allowDownload: boolean;
    restrictScreenCapture: boolean;
    allowPrint: boolean;
    preventReshare: boolean;
    watermark: WatermarkConfig;
    expiresAt: string | null;
    accessCount: number;
    maxAccessCount: number | null;
    status: string;
    recipientIdentifier?: string;
    showOwnerName?: boolean;
    ownerName?: string;
    shareMethod?: string;
  };
}

// Global flag to allow simulated offline testing even when Wi-Fi is active
let simulatedOfflineMode = false;

export const api = {
  // Offline simulation toggle
  setSimulatedOffline(isOffline: boolean) {
    simulatedOfflineMode = isOffline;
  },

  isOfflineMode(): boolean {
    return simulatedOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);
  },

  // Auth
  async getMe(userId?: string): Promise<{ user: User; isOffline?: boolean }> {
    if (this.isOfflineMode()) {
      const cachedUser = await offlineStorage.getUser(userId);
      if (cachedUser) {
        return { user: cachedUser, isOffline: true };
      }
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      const res = await fetch(`/api/auth/me?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to get session');
      const data = await res.json();
      if (data.user) {
        // Save user session to encrypted offline storage
        offlineStorage.saveUser(data.user).catch(() => {});
      }
      return data;
    } catch (err) {
      // Fallback to offline cached user
      const cachedUser = await offlineStorage.getUser(userId);
      if (cachedUser) {
        return { user: cachedUser, isOffline: true };
      }
      throw err;
    }
  },

  async login(credentials: { email: string; password?: string } | string, password?: string): Promise<LoginResponse & { user?: User; token?: string; requiresMfa?: boolean; sampleOtp?: string }> {
    const payload = typeof credentials === 'string' ? { email: credentials, password } : credentials;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Authentication error');
    }
    const data = await res.json();
    return {
      ...data,
      requiresMfa: data.mfaRequired,
      sampleOtp: data.generatedOtp
    };
  },

  async verifyMfa(payload: { userId: string; otpCode?: string; otp?: string } | string, otpParam?: string): Promise<MfaVerifyResponse> {
    const userId = typeof payload === 'string' ? payload : payload.userId;
    const otp = typeof payload === 'string' ? otpParam : (payload.otpCode || payload.otp);
    const res = await fetch('/api/auth/verify-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Verification failed' }));
      throw new Error(err.error || 'MFA validation failed');
    }
    const data = await res.json();
    if (data.user) {
      offlineStorage.saveUser(data.user).catch(() => {});
    }
    return data;
  },

  async register(data: { name: string; email: string; password?: string; department?: string } | string, emailParam?: string, deptParam?: string): Promise<any> {
    const payload = typeof data === 'string'
      ? { name: data, email: emailParam, department: deptParam }
      : data;
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration error');
    }
    const resJson = await res.json();
    return {
      ...resJson,
      requiresMfa: true,
      sampleOtp: '849201'
    };
  },

  // Multi-Person Profiles Management
  async getProfiles(): Promise<PersonProfile[]> {
    try {
      const res = await fetch('/api/profiles');
      if (!res.ok) throw new Error('Failed to load profiles');
      const profiles: PersonProfile[] = await res.json();
      if (typeof window !== 'undefined' && Array.isArray(profiles)) {
        localStorage.setItem('myspace_cached_profiles', JSON.stringify(profiles));
      }
      return profiles;
    } catch (err) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('myspace_cached_profiles');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch (_) {}
        }
      }
      return [];
    }
  },

  async createProfile(payload: CreatePersonProfilePayload): Promise<PersonProfile & { user?: User }> {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create profile' }));
      throw new Error(err.error || 'Failed to create profile');
    }
    const data = await res.json();
    return data;
  },

  async updateProfile(id: string, payload: Partial<CreatePersonProfilePayload>): Promise<PersonProfile & { user?: User }> {
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(err.error || 'Failed to update profile');
    }
    return await res.json();
  },

  async deleteProfile(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete profile' }));
      throw new Error(err.error || 'Failed to delete profile');
    }
    return await res.json();
  },

  // Documents
  async getDocuments(userId?: string): Promise<VaultDocument[]> {
    if (this.isOfflineMode()) {
      const offlineDocs = await offlineStorage.getDocuments(userId);
      return offlineDocs.map(d => ({ ...d, isOfflineAvailable: true }));
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load documents');
      const docs: VaultDocument[] = await res.json();

      // Automatically store in encrypted offline IndexedDB cache
      if (Array.isArray(docs) && docs.length > 0) {
        offlineStorage.saveDocumentsBatch(docs).catch(err => {
          console.warn('[MySpace] Batch offline caching notice:', err);
        });
      }

      return docs.map(d => ({ ...d, isOfflineAvailable: true }));
    } catch (err) {
      console.warn('[MySpace] Network fetch failed, falling back to encrypted offline cache:', err);
      const offlineDocs = await offlineStorage.getDocuments(userId);
      if (offlineDocs && offlineDocs.length > 0) {
        return offlineDocs.map(d => ({ ...d, isOfflineAvailable: true }));
      }
      throw err;
    }
  },

  async getDocument(id: string): Promise<VaultDocument> {
    if (this.isOfflineMode()) {
      const cached = await offlineStorage.getDocumentById(id);
      if (cached) return { ...cached, isOfflineAvailable: true };
      throw new Error('Document not found in offline encrypted storage');
    }

    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      const doc: VaultDocument = await res.json();
      offlineStorage.saveDocument(doc).catch(() => {});
      return { ...doc, isOfflineAvailable: true };
    } catch (err) {
      const cached = await offlineStorage.getDocumentById(id);
      if (cached) return { ...cached, isOfflineAvailable: true };
      throw err;
    }
  },

  async uploadDocument(data: {
    userId: string;
    ownerName: string;
    title: string;
    category: DocumentCategory;
    documentNumber?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    issueDate?: string;
    expiryDate?: string;
    reminderDaysBefore?: number;
    sensitivity: SensitivityLevel;
    tags: string[];
    notes?: string;
    fileContent: string;
    verifiedIssuer?: string;
    audioDurationSeconds?: number;
  }): Promise<VaultDocument> {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload error');
    }
    const newDoc: VaultDocument = await res.json();
    // Cache the uploaded encrypted document locally
    offlineStorage.saveDocument(newDoc).catch(() => {});
    return { ...newDoc, isOfflineAvailable: true };
  },

  async updateDocument(id: string, updates: Partial<VaultDocument>): Promise<VaultDocument> {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update document' }));
      throw new Error(err.error || 'Update error');
    }
    const updatedDoc: VaultDocument = await res.json();
    offlineStorage.saveDocument(updatedDoc).catch(() => {});
    return { ...updatedDoc, isOfflineAvailable: true };
  },

  async deleteDocument(id: string): Promise<{ message: string }> {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete document');
    const data = await res.json();
    // Purge from offline encrypted cache
    offlineStorage.deleteDocument(id).catch(() => {});
    return data;
  },

  // Hidden Space Management
  async getHiddenDocuments(userId?: string): Promise<VaultDocument[]> {
    if (this.isOfflineMode()) {
      const offlineDocs = await offlineStorage.getHiddenDocuments(userId);
      return offlineDocs.map(d => ({ ...d, isOfflineAvailable: true }));
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      const res = await fetch(`/api/documents/hidden?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load hidden documents');
      const docs: VaultDocument[] = await res.json();

      if (Array.isArray(docs) && docs.length > 0) {
        offlineStorage.saveDocumentsBatch(docs).catch(() => {});
      }

      return docs.map(d => ({ ...d, isOfflineAvailable: true }));
    } catch (err) {
      const offlineDocs = await offlineStorage.getHiddenDocuments(userId);
      if (offlineDocs && offlineDocs.length > 0) {
        return offlineDocs.map(d => ({ ...d, isOfflineAvailable: true }));
      }
      throw err;
    }
  },

  async hideDocument(id: string): Promise<VaultDocument> {
    if (this.isOfflineMode()) {
      const doc = await offlineStorage.getDocumentById(id);
      if (!doc) throw new Error('Document not found in offline vault');
      const updated: VaultDocument = {
        ...doc,
        isHidden: true,
        hiddenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await offlineStorage.saveDocument(updated);
      return updated;
    }

    const res = await fetch(`/api/documents/${id}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to hide document' }));
      throw new Error(err.error || 'Hide error');
    }
    const data = await res.json();
    if (data.document) {
      offlineStorage.saveDocument(data.document).catch(() => {});
      return data.document;
    }
    return data;
  },

  async unhideDocument(id: string): Promise<VaultDocument> {
    if (this.isOfflineMode()) {
      const doc = await offlineStorage.getDocumentById(id);
      if (!doc) throw new Error('Document not found in offline vault');
      const updated: VaultDocument = {
        ...doc,
        isHidden: false,
        updatedAt: new Date().toISOString()
      };
      delete updated.hiddenAt;
      await offlineStorage.saveDocument(updated);
      return updated;
    }

    const res = await fetch(`/api/documents/${id}/unhide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to restore document' }));
      throw new Error(err.error || 'Unhide error');
    }
    const data = await res.json();
    if (data.document) {
      offlineStorage.saveDocument(data.document).catch(() => {});
      return data.document;
    }
    return data;
  },

  async batchHideDocuments(ids: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch('/api/documents/batch-hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to hide selected documents' }));
      throw new Error(err.error || 'Batch hide error');
    }
    return res.json();
  },

  async batchUnhideDocuments(ids: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch('/api/documents/batch-unhide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to restore selected documents' }));
      throw new Error(err.error || 'Batch unhide error');
    }
    return res.json();
  },

  async batchDeleteDocuments(ids: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch('/api/documents/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete selected documents' }));
      throw new Error(err.error || 'Batch delete error');
    }
    return res.json();
  },

  async exportBulkDocuments(options: {
    userId?: string;
    selectedDocIds?: string[];
  }): Promise<{ success: boolean; count: number; hiddenExcludedCount: number; documents: VaultDocument[] }> {
    const res = await fetch('/api/documents/export/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk export request failed' }));
      throw new Error(err.error || 'Export error');
    }
    return res.json();
  },

  async auditExportDownload(data: {
    userId?: string;
    documentCount: number;
    fileName: string;
    checksumSha256: string;
  }): Promise<{ success: boolean }> {
    try {
      const res = await fetch('/api/documents/export/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    } catch {
      return { success: true };
    }
  },

  // QR Shares & Secure Sharing Settings
  async createShare(
    data: CreateSharePayload
  ): Promise<ShareLink & { publicShareUrl: string; simulatedOtp?: string }> {
    if (this.isOfflineMode()) {
      const doc = await offlineStorage.getDocumentById(data.documentId);
      const token = `token_lv_${Math.random().toString(36).substring(2, 14)}`;
      const publicShareUrl = `${window.location.origin}/share/${token}`;
      let qrCodeDataUrl = '';
      try {
        const QRCode = (await import('qrcode')).default;
        qrCodeDataUrl = await QRCode.toDataURL(publicShareUrl, { margin: 2, width: 400 });
      } catch (e) {
        console.warn('QR code generation failed offline, using placeholder', e);
      }

      const duration = data.durationMinutes;
      const expiresAt = duration !== null && duration !== undefined
        ? new Date(Date.now() + duration * 60 * 1000).toISOString()
        : null;

      const newShare: ShareLink = {
        id: `shr_${Date.now()}`,
        token,
        documentId: data.documentId,
        documentTitle: doc?.title || 'Document',
        documentCategory: doc?.category || 'OTHER',
        documentNumber: doc?.documentNumber,
        fileType: doc?.fileType || 'application/pdf',
        fileSize: doc?.fileSize || 1024,
        userId: doc?.userId || 'user_1',
        ownerName: doc?.ownerName || 'Vault Owner',
        durationMinutes: duration,
        createdAt: new Date().toISOString(),
        expiresAt,
        maxAccessCount: data.maxAccessCount,
        accessCount: 0,
        permission: data.allowDownload ? 'ALLOW_DOWNLOAD' : 'VIEW_ONLY',
        allowDownload: data.allowDownload,
        restrictScreenCapture: data.restrictScreenCapture,
        allowPrint: data.allowPrint,
        preventReshare: data.preventReshare,
        accessType: data.accessType,
        recipientIdentifier: data.recipientIdentifier,
        recipientVerification: data.recipientVerification,
        requirePasscode: Boolean(data.passcode || data.recipientVerification === 'PIN'),
        passcodeHash: data.passcode,
        passcodeHint: data.passcodeHint,
        otpCode: data.otpCode || (data.recipientVerification === 'OTP' ? '123456' : undefined),
        watermark: data.watermark,
        advancedSecurity: data.advancedSecurity,
        isSensitivePreset: data.isSensitivePreset,
        status: 'ACTIVE',
        qrCodeDataUrl,
        accessLogs: [
          {
            id: `acc_${Date.now()}`,
            shareToken: token,
            timestamp: new Date().toISOString(),
            ip: '127.0.0.1 (Offline)',
            userAgent: navigator.userAgent,
            action: 'VIEW',
            status: 'SUCCESS',
            notes: 'Share link generated offline'
          }
        ]
      };
      await offlineStorage.saveShares([newShare]);
      return { ...newShare, publicShareUrl, simulatedOtp: newShare.otpCode };
    }

    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create share' }));
      throw new Error(err.error || 'Share link generation failed');
    }
    return res.json();
  },

  async modifyShare(
    id: string,
    updates: {
      durationMinutes?: number | null;
      maxAccessCount?: number | null;
      allowDownload?: boolean;
      allowPrint?: boolean;
      preventReshare?: boolean;
      restrictScreenCapture?: boolean;
      watermark?: Partial<WatermarkConfig>;
      advancedSecurity?: any;
      resetToActive?: boolean;
    }
  ): Promise<{ message: string; share: ShareLink }> {
    const res = await fetch(`/api/shares/${id}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to modify share' }));
      throw new Error(err.error || 'Share modification failed');
    }
    return res.json();
  },

  async getShares(userId?: string, role?: string): Promise<ShareLink[]> {
    if (this.isOfflineMode()) {
      return await offlineStorage.getShares();
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (role) params.append('role', role);
      const res = await fetch(`/api/shares?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load share links');
      const data: ShareLink[] = await res.json();
      if (Array.isArray(data)) {
        offlineStorage.saveShares(data).catch(() => {});
      }
      return data;
    } catch (err) {
      const cached = await offlineStorage.getShares();
      return cached;
    }
  },

  async revokeShare(id: string, reason?: string): Promise<any> {
    const res = await fetch(`/api/shares/${id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to revoke share link');
    return res.json();
  },

  async revokeFileFromShare(shareId: string, documentId: string, reason?: string): Promise<any> {
    const res = await fetch(`/api/shares/${shareId}/revoke-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, reason })
    });
    if (!res.ok) throw new Error('Failed to revoke file from share session');
    return res.json();
  },

  // Public Share Receiver
  async accessPublicShare(token: string, deviceId?: string): Promise<PublicShareResponse> {
    const url = deviceId ? `/api/public/share/${token}?deviceId=${encodeURIComponent(deviceId)}` : `/api/public/share/${token}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({
      expired: true,
      message: '🔒 This document sharing link has expired or is no longer available.'
    }));
    return data;
  },

  async accessSharedFile(token: string, docId: string, passcode?: string, otp?: string): Promise<any> {
    const params = new URLSearchParams();
    if (passcode) params.set('passcode', passcode);
    if (otp) params.set('otp', otp);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/public/share/${token}/file/${docId}${qs}`);
    return res.json();
  },

  async verifySharePasscode(
    token: string,
    code: string,
    isOtp: boolean = false,
    deviceId?: string,
    documentId?: string
  ): Promise<PublicShareResponse> {
    const res = await fetch(`/api/public/share/${token}/verify-passcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passcode: code,
        otp: code,
        deviceId,
        documentId
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Verification failed' }));
      throw new Error(err.error || (isOtp ? 'Invalid OTP' : 'Incorrect PIN'));
    }
    return res.json();
  },

  async downloadSharedDocument(token: string, documentId?: string): Promise<{ success: boolean; fileName: string; decryptedContent: string }> {
    const res = await fetch(`/api/public/share/${token}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(err.error || 'Downloading this document has been restricted by the owner.');
    }
    return res.json();
  },

  async logShareAction(token: string, action: string, notes?: string): Promise<void> {
    try {
      await fetch(`/api/public/share/${token}/log-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes })
      });
    } catch {
      // Non-critical telemetry logging
    }
  },

  // Facial Biometrics
  async registerFace(userId: string, embedding: number[], livenessVerified: boolean = true): Promise<{ success: boolean; message: string; user: User }> {
    const res = await fetch('/api/auth/face/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, embedding, livenessVerified })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Face registration failed' }));
      throw new Error(err.error || 'Failed to enroll facial biometric template');
    }
    const data = await res.json();
    if (data.user) {
      offlineStorage.saveUser(data.user).catch(() => {});
    }
    return data;
  },

  async verifyFace(userId: string, embedding: number[], livenessVerified: boolean = true): Promise<{ verified: boolean; similarity: number; token: string; user: User; message: string }> {
    const res = await fetch('/api/auth/face/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, embedding, livenessVerified })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Facial verification failed' }));
      const errorObj = new Error(err.error || 'Facial verification rejected') as any;
      errorObj.similarity = err.similarity;
      errorObj.remainingAttempts = err.remainingAttempts;
      errorObj.requiresMfaFallback = err.requiresMfaFallback;
      errorObj.locked = err.locked;
      throw errorObj;
    }
    const data = await res.json();
    if (data.user) {
      offlineStorage.saveUser(data.user).catch(() => {});
    }
    return data;
  },

  async testFace(userId: string, embedding: number[], livenessVerified: boolean = true): Promise<{ verified: boolean; similarity: number; threshold: number; livenessVerified: boolean; message: string }> {
    const res = await fetch('/api/auth/face/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, embedding, livenessVerified })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Face test failed' }));
      throw new Error(err.error || 'Biometric test error');
    }
    return res.json();
  },

  async toggleFaceAuth(userId: string, enabled: boolean): Promise<{ success: boolean; faceAuthEnabled: boolean; user: User }> {
    const res = await fetch('/api/auth/face/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, enabled })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update biometric settings' }));
      throw new Error(err.error || 'Face toggle error');
    }
    const data = await res.json();
    if (data.user) {
      offlineStorage.saveUser(data.user).catch(() => {});
    }
    return data;
  },

  async deleteFaceData(userId: string): Promise<{ success: boolean; message: string; user: User }> {
    const res = await fetch('/api/auth/face/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete facial data' }));
      throw new Error(err.error || 'Purge biometric error');
    }
    const data = await res.json();
    if (data.user) {
      offlineStorage.saveUser(data.user).catch(() => {});
    }
    return data;
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    if (this.isOfflineMode()) {
      return await offlineStorage.getAuditLogs();
    }

    try {
      const res = await fetch('/api/audit-logs');
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data: AuditLog[] = await res.json();
      if (Array.isArray(data)) {
        offlineStorage.saveAuditLogs(data).catch(() => {});
      }
      return data;
    } catch (err) {
      const cached = await offlineStorage.getAuditLogs();
      return cached;
    }
  },

  async getCryptoBenchmark(): Promise<any> {
    const res = await fetch('/api/crypto/benchmark');
    if (!res.ok) throw new Error('Failed to run benchmark');
    return res.json();
  },

  async getStorageStatus(userId?: string): Promise<{
    status: string;
    storageMode: string;
    unlimitedCapacity: boolean;
    storageUsedBytes: number;
    documentCount: number;
    maxSingleFileBytes: number;
    encryptionStandard: string;
    zeroKnowledgeTags: boolean;
    scalableBacking: string;
  }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const res = await fetch(`/api/storage/status?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch storage status');
    return res.json();
  },

  // Dedicated Offline Storage Utilities
  offline: {
    getStats(): Promise<OfflineCacheStats> {
      return offlineStorage.getStats();
    },
    async cacheAll(docs: VaultDocument[]): Promise<void> {
      await offlineStorage.saveDocumentsBatch(docs);
    },
    async clearCache(): Promise<void> {
      await offlineStorage.clearAll();
    }
  }
};

