import { DocumentCategory, SensitivityLevel, ShareStatus } from '../types.js';

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'Permanent / No Expiry';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function getExpiryStatus(expiryDate?: string): {
  status: 'PERMANENT' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  label: string;
  daysRemaining?: number;
  colorClass: string;
} {
  if (!expiryDate) {
    return {
      status: 'PERMANENT',
      label: 'No Expiry',
      colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
  }

  const now = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'EXPIRED',
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      daysRemaining: diffDays,
      colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'EXPIRING_SOON',
      label: `Expiring in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      daysRemaining: diffDays,
      colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
    };
  }

  return {
    status: 'VALID',
    label: `Valid (${diffDays} days)`,
    daysRemaining: diffDays,
    colorClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20'
  };
}

export function getCategoryBadge(category: DocumentCategory): {
  label: string;
  colorClass: string;
  iconName: string;
} {
  switch (category) {
    case 'IDENTITY':
      return { label: 'National ID & Identity', colorClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30', iconName: 'UserCheck' };
    case 'EDUCATION':
      return { label: 'Education & Degree', colorClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30', iconName: 'GraduationCap' };
    case 'EMPLOYMENT':
      return { label: 'Internship & Career', colorClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', iconName: 'Briefcase' };
    case 'MEDICAL':
      return { label: 'Medical & Health', colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30', iconName: 'HeartPulse' };
    case 'FINANCIAL':
      return { label: 'Financial & PAN', colorClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', iconName: 'CreditCard' };
    case 'VOICE_AUDIO':
      return { label: 'Voice & Audio', colorClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30', iconName: 'Mic' };
    case 'LEGAL':
      return { label: 'Legal & Property', colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', iconName: 'ShieldAlert' };
    default:
      return { label: 'General Document', colorClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30', iconName: 'FileText' };
  }
}

export function getSensitivityBadge(level: SensitivityLevel): {
  label: string;
  colorClass: string;
} {
  switch (level) {
    case 'TOP_SECRET':
      return { label: 'Top Secret (Zero Knowledge)', colorClass: 'bg-red-500/20 text-red-400 border-red-500/40' };
    case 'CONFIDENTIAL':
      return { label: 'Confidential (GCM Encrypted)', colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    case 'RESTRICTED':
      return { label: 'Restricted Access', colorClass: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' };
    default:
      return { label: 'Standard Vault File', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  }
}

export function getShareStatusBadge(status: ShareStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active & Accessible', colorClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'EXPIRED':
      return { label: 'Expired (Time Elapsed)', colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    case 'EXHAUSTED':
      return { label: 'Exhausted (Limit Reached)', colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'REVOKED':
      return { label: 'Manually Revoked', colorClass: 'bg-red-900/40 text-red-300 border-red-700/50' };
  }
}

export function getTimeRemainingString(expiresAt: string): { text: string; isExpired: boolean; secondsRemaining: number } {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diff = Math.floor((exp - now) / 1000);

  if (diff <= 0) {
    return { text: 'Expired', isExpired: true, secondsRemaining: 0 };
  }

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m ${seconds}s`,
      isExpired: false,
      secondsRemaining: diff
    };
  }

  return {
    text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    isExpired: false,
    secondsRemaining: diff
  };
}

export function formatAudioDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined || totalSeconds === null || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remMinutes = minutes % 60;
    return `${hours}:${String(remMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isAudioFile(fileType?: string, fileName?: string, category?: string): boolean {
  if (category === 'VOICE_AUDIO') return true;
  if (fileType && (fileType.startsWith('audio/') || fileType.includes('audio') || fileType.includes('ogg') || fileType.includes('wav') || fileType.includes('mp3') || fileType.includes('m4a') || fileType.includes('aac'))) return true;
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'weba', 'webm', 'flac', 'opus'].includes(ext)) {
      return true;
    }
  }
  return false;
}

