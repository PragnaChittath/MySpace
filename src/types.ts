export type Role = 'USER';

export type NavigationTab = 'vault' | 'shares' | 'audit';

export type DocumentCategory =
  | 'IDENTITY'
  | 'EDUCATION'
  | 'EMPLOYMENT'
  | 'MEDICAL'
  | 'FINANCIAL'
  | 'LEGAL'
  | 'VOICE_AUDIO'
  | 'OTHER';

export type SensitivityLevel =
  | 'STANDARD'
  | 'RESTRICTED'
  | 'CONFIDENTIAL'
  | 'TOP_SECRET';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  department?: string;
  relationship?: string;
  avatarColor?: string;
  notes?: string;
  isPrimary?: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  faceAuthEnabled?: boolean;
  hasFaceBiometrics?: boolean;
  faceRegisteredAt?: string;
  failedFaceAttempts?: number;
  createdAt: string;
  lastLoginAt?: string;
  storageUsedBytes: number;
  storageMode?: 'UNLIMITED' | 'SCALABLE';
}

export interface PersonProfile {
  id: string;
  name: string;
  email?: string;
  relationship: string;
  avatarUrl?: string;
  avatarColor?: string;
  notes?: string;
  isPrimary?: boolean;
  documentCount: number;
  storageUsedBytes: number;
  createdAt: string;
}

export interface CreatePersonProfilePayload {
  name: string;
  relationship?: string;
  email?: string;
  avatarUrl?: string;
  avatarColor?: string;
  notes?: string;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: 'AES-256-GCM';
  keyDerivation: 'PBKDF2-HMAC-SHA256';
  iterations: number;
  salt: string;
  checksumSha256: string;
}

export interface VaultDocument {
  id: string;
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
  encryption: EncryptedData;
  decryptedPreviewData?: string; // Data URL or text preview for client view
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  isHidden?: boolean;
  hiddenAt?: string;
  shareCount: number;
  verifiedIssuer?: string;
  isOfflineAvailable?: boolean;
  cachedAt?: string;
  audioDurationSeconds?: number;
  isAudio?: boolean;
}

export type SharePermission = 'VIEW_ONLY' | 'DOWNLOAD' | 'VIEW_AND_DOWNLOAD' | 'ALLOW_DOWNLOAD';

export type ShareStatus = 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED';

export type ShareMethod = 'DIRECT' | 'QR';

export type AccessType =
  | 'ANYONE'
  | 'SPECIFIC_PERSON'
  | 'EMAIL'
  | 'PHONE'
  | 'REQUIRE_OTP'
  | 'REQUIRE_PIN';

export type RecipientVerification = 'NONE' | 'OTP' | 'EMAIL' | 'PHONE' | 'PIN';

export interface WatermarkConfig {
  enabled: boolean;
  recipientName?: string;
  recipientContact?: string;
  ownerName?: string;
  customText?: string;
  showTimestamp?: boolean;
}

export interface AdvancedSharingSecurity {
  autoExpire: boolean;
  revokeAnytime: boolean;
  oneDeviceOnly: boolean;
  boundDeviceId?: string;
  boundIp?: string;
  restrictToVerifiedRecipient: boolean;
  notifyOnOpen: boolean;
  notifyOnDownload: boolean;
  maintainAccessHistory: boolean;
  failedAuthAttempts?: number;
  lastAccessedAt?: string;
}

export interface ShareAccessLog {
  id: string;
  shareToken: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  action:
    | 'VIEW'
    | 'DOWNLOAD'
    | 'FAILED_PASSCODE'
    | 'FAILED_OTP'
    | 'OTP_VERIFIED'
    | 'EXPIRED_ATTEMPT'
    | 'DOWNLOAD_BLOCKED'
    | 'PRINT_BLOCKED'
    | 'RESHARE_BLOCKED'
    | 'DEVICE_MISMATCH';
  status: 'SUCCESS' | 'BLOCKED';
  notes?: string;
}

export interface ShareFileConfig {
  documentId: string;
  documentTitle: string;
  documentCategory: DocumentCategory;
  documentNumber?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  durationMinutes: number | null; // per-file duration
  expiresAt: string | null; // per-file expiration
  permission: SharePermission; // 'VIEW_ONLY' | 'DOWNLOAD' | 'VIEW_AND_DOWNLOAD'
  allowDownload: boolean;
  requirePasscode?: boolean;
  passcodeHash?: string;
  passcodeHint?: string;
  requireOtp?: boolean;
  otpCode?: string;
  status: ShareStatus; // 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  revokedAt?: string;
  revocationReason?: string;
}

export interface ShareLink {
  id: string;
  token: string;
  // Primary / fallback document details (for single-file backward compatibility)
  documentId: string;
  documentTitle: string;
  documentCategory: DocumentCategory;
  documentNumber?: string;
  fileType: string;
  fileSize: number;

  // Multi-file support
  isMultiFile?: boolean;
  files?: ShareFileConfig[];

  userId: string;
  ownerName: string;
  showOwnerName?: boolean;
  shareMethod?: ShareMethod;
  durationMinutes: number | null; // null = no expiry
  createdAt: string;
  expiresAt: string | null; // null = no expiry
  maxAccessCount: number | null; // null = unlimited within time window, 1 = single-use
  accessCount: number;
  permission: SharePermission;
  allowDownload: boolean;
  restrictScreenCapture: boolean;
  allowPrint: boolean;
  preventReshare: boolean;
  accessType: AccessType;
  recipientIdentifier?: string;
  recipientVerification: RecipientVerification;
  requirePasscode: boolean;
  passcodeHash?: string;
  passcodeHint?: string;
  otpCode?: string;
  watermark: WatermarkConfig;
  advancedSecurity: AdvancedSharingSecurity;
  isSensitivePreset?: boolean;
  status: ShareStatus;
  revokedAt?: string;
  revocationReason?: string;
  qrCodeDataUrl?: string;
  accessLogs: ShareAccessLog[];
}

export interface ShareFilePayloadConfig {
  documentId: string;
  durationMinutes?: number | null;
  permission?: SharePermission;
  allowDownload?: boolean;
  requirePasscode?: boolean;
  passcode?: string;
  passcodeHint?: string;
  requireOtp?: boolean;
  otpCode?: string;
}

export interface CreateSharePayload {
  documentId?: string;
  documentIds?: string[];
  files?: ShareFilePayloadConfig[];
  durationMinutes: number | null;
  maxAccessCount?: number | null;
  permission?: SharePermission;
  shareMethod?: ShareMethod;
  showOwnerName?: boolean;
  allowDownload: boolean;
  restrictScreenCapture: boolean;
  allowPrint: boolean;
  preventReshare: boolean;
  accessType: AccessType;
  recipientIdentifier?: string;
  recipientVerification: RecipientVerification;
  passcode?: string;
  passcodeHint?: string;
  otpCode?: string;
  watermark: WatermarkConfig;
  advancedSecurity: AdvancedSharingSecurity;
  isSensitivePreset?: boolean;
}

export type AuditCategory = 'AUTH' | 'CRYPTO' | 'DOCUMENT' | 'SHARING' | 'BIOMETRICS' | 'SYSTEM' | 'ADMIN';
export type AuditSeverity = 'INFO' | 'WARNING' | 'ALERT' | 'SECURITY';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  ipAddress: string;
  details: string;
  resourceId?: string;
  resourceName?: string;
  integrityHash: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  isFaceAuthRequired?: boolean;
  tempAuthData?: {
    userId: string;
    email: string;
    generatedOtp?: string;
    expiresAt?: number;
    faceAuthEnabled?: boolean;
  };
}

export interface VaultStats {
  totalDocuments: number;
  activeShares: number;
  expiringSoonCount: number;
  expiredCount: number;
  storageUsedBytes: number;
  storageMode?: 'UNLIMITED' | 'SCALABLE';
  securityIntegrityScore: number;
  recentAuditCount: number;
  categoriesCount: Record<DocumentCategory, number>;
}
