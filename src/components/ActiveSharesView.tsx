import { useState, useEffect } from 'react';
import {
  QrCode,
  Clock,
  Flame,
  Shield,
  Ban,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  History,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Lock,
  Sliders,
  Printer,
  Share2,
  ShieldCheck,
  UserCheck,
  X,
  FileText,
  ArrowUpRight
} from 'lucide-react';
import { ShareLink, User } from '../types.js';
import { api } from '../services/api.js';
import {
  formatDate,
  getShareStatusBadge,
  getTimeRemainingString,
  getCategoryBadge
} from '../utils/formatters.js';

interface ActiveSharesViewProps {
  currentUser: User | null;
  shares: ShareLink[];
  onRefresh: () => void;
  onOpenPublicView: (token: string) => void;
}

export function ActiveSharesView({
  currentUser,
  shares,
  onRefresh,
  onOpenPublicView
}: ActiveSharesViewProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'DIRECT' | 'QR'>('ALL');
  const [expandedShareId, setExpandedShareId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Modification Modal state
  const [modifyingShare, setModifyingShare] = useState<ShareLink | null>(null);
  const [modDurationMinutes, setModDurationMinutes] = useState<number | null>(60);
  const [modMaxViews, setModMaxViews] = useState<number | null>(5);
  const [modAllowDownload, setModAllowDownload] = useState<boolean>(false);
  const [modAllowPrint, setModAllowPrint] = useState<boolean>(false);
  const [modPreventReshare, setModPreventReshare] = useState<boolean>(true);
  const [modResetActive, setModResetActive] = useState<boolean>(true);
  const [isSavingMod, setIsSavingMod] = useState<boolean>(false);

  // QR Showcase modal state
  const [viewingQrShare, setViewingQrShare] = useState<ShareLink | null>(null);

  // Status banner notification
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showStatusNotice = (type: 'success' | 'error', message: string) => {
    setStatusNotice({ type, message });
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // Live timer tick every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredShares = shares.filter(s => {
    if (methodFilter === 'DIRECT' && s.shareMethod !== 'DIRECT') return false;
    if (methodFilter === 'QR' && s.shareMethod === 'DIRECT') return false;
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return s.status === 'ACTIVE';
    if (filterStatus === 'EXPIRED') return s.status === 'EXPIRED' || s.status === 'EXHAUSTED';
    if (filterStatus === 'REVOKED') return s.status === 'REVOKED';
    return true;
  });

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this QR share link immediately? Any ongoing session will be terminated.')) {
      return;
    }
    setRevokingId(shareId);
    try {
      await api.revokeShare(shareId, 'Manually revoked by vault owner');
      onRefresh();
      showStatusNotice('success', 'QR share link revoked successfully.');
    } catch (e) {
      showStatusNotice('error', 'Failed to revoke share link.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Open Modification Modal
  const handleOpenModifyModal = (share: ShareLink) => {
    setModifyingShare(share);
    setModDurationMinutes(share.durationMinutes || 60);
    setModMaxViews(share.maxAccessCount);
    setModAllowDownload(share.allowDownload ?? false);
    setModAllowPrint(share.allowPrint ?? false);
    setModPreventReshare(share.preventReshare ?? true);
    setModResetActive(share.status !== 'ACTIVE');
  };

  // Save Modified Settings
  const handleSaveModification = async () => {
    if (!modifyingShare) return;
    setIsSavingMod(true);
    try {
      await api.modifyShare(modifyingShare.id, {
        durationMinutes: modDurationMinutes,
        maxAccessCount: modMaxViews,
        allowDownload: modAllowDownload,
        allowPrint: modAllowPrint,
        preventReshare: modPreventReshare,
        resetToActive: modResetActive
      });
      setModifyingShare(null);
      onRefresh();
      showStatusNotice('success', 'Sharing parameters updated successfully.');
    } catch (err: any) {
      showStatusNotice('error', err.message || 'Failed to update sharing settings.');
    } finally {
      setIsSavingMod(false);
    }
  };

  const activeCount = shares.filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">QR ENGINE</span>
            <div className="flex items-center text-[11px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-1.5 animate-pulse"></span>
              Secure Ephemeral Access
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Active QR Shares & Document Links
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time access countdowns, verify recipient audit logs, and modify or revoke tokens on demand
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
            <div className="text-lg font-bold text-teal-400">{activeCount}</div>
            <div className="text-[9px] uppercase font-semibold text-slate-500">Live Active</div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Shares"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Notice Banner */}
      {statusNotice && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
          statusNotice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const).map(status => {
            const count =
              status === 'ALL'
                ? shares.length
                : status === 'ACTIVE'
                ? shares.filter(s => s.status === 'ACTIVE').length
                : status === 'EXPIRED'
                ? shares.filter(s => s.status === 'EXPIRED' || s.status === 'EXHAUSTED').length
                : shares.filter(s => s.status === 'REVOKED').length;

            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                  filterStatus === status
                    ? 'bg-teal-600 text-slate-950 font-bold border-teal-500 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>{status === 'ALL' ? 'All Statuses' : status}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterStatus === status ? 'bg-teal-900 text-teal-100' : 'bg-slate-800'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Method Filter */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMethodFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              methodFilter === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Types
          </button>
          <button
            onClick={() => setMethodFilter('DIRECT')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              methodFilter === 'DIRECT' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Direct Shares ({shares.filter(s => s.shareMethod === 'DIRECT').length})
          </button>
          <button
            onClick={() => setMethodFilter('QR')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              methodFilter === 'QR' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Shares ({shares.filter(s => s.shareMethod !== 'DIRECT').length})
          </button>
        </div>
      </div>

      {/* Shares List */}
      {filteredShares.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/50 border border-slate-800">
          <QrCode className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-medium text-white">No share links match this filter</h3>
          <p className="text-xs text-slate-500 mt-1">
            Generate a Direct Share link or time-limited QR code from any document in your vault.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShares.map(share => {
            const statusBadge = getShareStatusBadge(share.status);
            const timeRemaining = share.expiresAt ? getTimeRemainingString(share.expiresAt) : { text: 'No Expiry', isExpired: false };
            const isExpanded = expandedShareId === share.id;

            return (
              <div
                key={share.id}
                className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden text-slate-300 transition-all hover:border-slate-700"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Direct Share Thumbnail or QR Mini Preview + Document Info */}
                  <div className="flex items-start gap-4">
                    {share.shareMethod === 'DIRECT' ? (
                      <div className="w-14 h-14 rounded-xl bg-teal-950/60 border border-teal-500/40 flex flex-col items-center justify-center text-teal-300 shrink-0 shadow-md">
                        <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
                        <span className="text-[8px] font-mono uppercase font-bold tracking-wider text-teal-400">Direct</span>
                      </div>
                    ) : share.qrCodeDataUrl ? (
                      <button
                        type="button"
                        onClick={() => setViewingQrShare(share)}
                        className="p-1 rounded-lg bg-white shadow-sm shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                        title="Click to view full QR code"
                      >
                        <img
                          src={share.qrCodeDataUrl}
                          alt="QR Mini"
                          className="w-14 h-14 rounded object-contain"
                        />
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        <QrCode className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm text-white">{share.documentTitle}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusBadge.colorClass}`}>
                          {statusBadge.label}
                        </span>

                        {/* Share Method Badge */}
                        {share.shareMethod === 'DIRECT' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-teal-400" /> Direct Share
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                            <QrCode className="w-3 h-3 text-slate-400" /> QR Share
                          </span>
                        )}

                        {share.isSensitivePreset && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Sensitive
                          </span>
                        )}

                        {/* Permission Badge */}
                        {share.permission === 'DOWNLOAD' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                            <FileDown className="w-3 h-3" /> Download Only
                          </span>
                        ) : share.permission === 'VIEW_AND_DOWNLOAD' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-900/30 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                            <FileDown className="w-3 h-3" /> View & Download
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> View Only
                          </span>
                        )}

                        {share.recipientVerification && share.recipientVerification !== 'NONE' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> {share.recipientVerification} Verified
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5 font-mono">
                        <span>
                          Token: <span className="text-teal-400 font-semibold">{share.token.substring(0, 14)}...</span>
                        </span>
                        <span>•</span>
                        <span>Created: {formatDate(share.createdAt)}</span>
                        {share.expiresAt && (
                          <>
                            <span>•</span>
                            <span>Expires: {formatDate(share.expiresAt)}</span>
                          </>
                        )}
                        {share.recipientIdentifier && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-300">Recipient: {share.recipientIdentifier}</span>
                          </>
                        )}
                        {share.otpCode && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">OTP: {share.otpCode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Live Countdown & Usage Meter */}
                  <div className="flex items-center gap-6 self-start md:self-center">
                    <div className="text-left md:text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {share.status === 'ACTIVE' ? 'Time Remaining' : 'Status'}
                      </div>
                      <div
                        className={`font-mono text-xs font-semibold mt-0.5 flex items-center gap-1.5 ${
                          share.status === 'ACTIVE'
                            ? 'text-emerald-400'
                            : share.status === 'REVOKED'
                            ? 'text-red-400'
                            : 'text-rose-400'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {share.status === 'ACTIVE' ? timeRemaining.text : share.status}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Views Used
                      </div>
                      <div className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">
                        {share.accessCount} / {share.maxAccessCount ? `${share.maxAccessCount} views` : '∞'}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleCopyLink(share.token)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Copy Public Link"
                    >
                      {copiedToken === share.token ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-teal-400" />
                      )}
                    </button>

                    <button
                      onClick={() => onOpenPublicView(share.token)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 border border-teal-500/30 transition-colors cursor-pointer"
                      title="Open Receiver View Simulator"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </button>

                    <button
                      onClick={() => handleOpenModifyModal(share)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Modify sharing settings (extend time, views, permissions)"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      Modify
                    </button>

                    {share.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevoke(share.id)}
                        disabled={revokingId === share.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 border border-rose-600/40 text-rose-300 transition-colors cursor-pointer"
                        title="Neutralize Token Immediately"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedShareId(isExpanded ? null : share.id)}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        isExpanded ? 'bg-teal-500/20 border-teal-500 text-teal-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title="View Access History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Access Logs per Share */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/70 border-t border-slate-800 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-teal-400" />
                        Activity Logs & Verification Timeline ({share.accessLogs?.length || 0} Events)
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{share.token}</span>
                    </div>

                    {(!share.accessLogs || share.accessLogs.length === 0) ? (
                      <div className="py-3 text-center text-xs text-slate-500">
                        No access attempts recorded yet for this link.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                            <tr>
                              <th className="py-2 px-3">Timestamp</th>
                              <th className="py-2 px-3">Action</th>
                              <th className="py-2 px-3">IP Address</th>
                              <th className="py-2 px-3">Details / Notes</th>
                              <th className="py-2 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {share.accessLogs.map((log, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/60">
                                <td className="py-2 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                <td className="py-2 px-3 font-semibold text-white">{log.action}</td>
                                <td className="py-2 px-3 text-teal-400">{log.ip}</td>
                                <td className="py-2 px-3 text-slate-400 truncate max-w-sm">{log.notes || log.userAgent}</td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      log.status === 'SUCCESS'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODIFY ACCESS MODAL */}
      {modifyingShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-teal-400" />
                <h2 className="text-base font-bold text-white">Modify Sharing Settings</h2>
              </div>
              <button
                onClick={() => setModifyingShare(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-slate-400">Target Document:</span>
              <div className="font-bold text-white truncate">{modifyingShare.documentTitle}</div>
            </div>

            {/* Adjust Duration */}
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-300">Access Expiry Window</label>
              <select
                value={modDurationMinutes === null ? 'none' : String(modDurationMinutes)}
                onChange={e => setModDurationMinutes(e.target.value === 'none' ? null : parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              >
                <option value="15">15 Minutes from now</option>
                <option value="60">1 Hour from now</option>
                <option value="360">6 Hours from now</option>
                <option value="1440">24 Hours from now</option>
                <option value="4320">3 Days from now</option>
                <option value="10080">7 Days from now</option>
                <option value="none">No Expiry (Until Revoked)</option>
              </select>
            </div>

            {/* Adjust Max Views */}
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-300">Maximum Views (Auto-burn limit)</label>
              <select
                value={modMaxViews === null ? 'unlimited' : String(modMaxViews)}
                onChange={e => setModMaxViews(e.target.value === 'unlimited' ? null : parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              >
                <option value="1">1 View (Single-use auto-burn)</option>
                <option value="3">3 Views</option>
                <option value="5">5 Views</option>
                <option value="10">10 Views</option>
                <option value="unlimited">Unlimited Views</option>
              </select>
            </div>

            {/* Toggle Permissions */}
            <div className="space-y-2 text-xs pt-1">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span>Allow File Download</span>
                <input
                  type="checkbox"
                  checked={modAllowDownload}
                  onChange={e => setModAllowDownload(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500"
                />
              </label>
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span>Allow Document Printing</span>
                <input
                  type="checkbox"
                  checked={modAllowPrint}
                  onChange={e => setModAllowPrint(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500"
                />
              </label>
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span>Prevent Re-sharing</span>
                <input
                  type="checkbox"
                  checked={modPreventReshare}
                  onChange={e => setModPreventReshare(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500"
                />
              </label>
              {modifyingShare.status !== 'ACTIVE' && (
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 cursor-pointer">
                  <span>Reactivate Token to Active</span>
                  <input
                    type="checkbox"
                    checked={modResetActive}
                    onChange={e => setModResetActive(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                  />
                </label>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModifyingShare(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModification}
                disabled={isSavingMod}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSavingMod ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL QR PREVIEW MODAL */}
      {viewingQrShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{viewingQrShare.documentTitle}</h3>
              <button
                onClick={() => setViewingQrShare(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl mx-auto inline-block shadow-xl">
              <img
                src={viewingQrShare.qrCodeDataUrl}
                alt="QR Code"
                className="w-56 h-56 rounded-lg"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {`${window.location.origin}/share/${viewingQrShare.token}`}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyLink(viewingQrShare.token)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer"
              >
                Copy Link
              </button>
              <button
                onClick={() => {
                  const tok = viewingQrShare.token;
                  setViewingQrShare(null);
                  onOpenPublicView(tok);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer"
              >
                Test in Scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
