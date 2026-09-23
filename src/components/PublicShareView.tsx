import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Download,
  AlertTriangle,
  Clock,
  KeyRound,
  Eye,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FileAudio,
  FileText,
  File,
  Film,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { api, PublicShareResponse } from '../services/api.js';
import { formatBytes, getTimeRemainingString, getCategoryBadge, formatAudioDuration, isAudioFile } from '../utils/formatters.js';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer.js';

interface PublicShareViewProps {
  token: string;
  onBackToVault: () => void;
}

export function PublicShareView({ token, onBackToVault }: PublicShareViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicShareResponse | null>(null);

  // Active file selection in case of multi-file shares
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // Verification state (OTP / PIN)
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [, setTick] = useState(0);

  // Audio Playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Client device ID fingerprint
  const getDeviceId = () => {
    let devId = sessionStorage.getItem('lv_device_fingerprint');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem('lv_device_fingerprint', devId);
    }
    return devId;
  };

  const fetchShareData = async () => {
    setLoading(true);
    try {
      const devId = getDeviceId();
      const res = await api.accessPublicShare(token, devId);
      setData(res);
      if (res.files && res.files.length > 0 && !res.document) {
        // Auto-select first file for multi-file share
        handleSelectMultiFile(res.files[0].documentId);
      }
    } catch {
      setData({
        expired: true,
        message: 'This document link has expired or is no longer available.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMultiFile = async (docId: string) => {
    setSelectedFileId(docId);
    setLoadingFile(true);
    try {
      const fileData = await api.accessSharedFile(token, docId);
      if (fileData.document) {
        setData(prev => prev ? {
          ...prev,
          document: fileData.document
        } : null);
      }
    } catch (e: any) {
      showToast(e.message || 'Unable to open file');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    fetchShareData();
  }, [token]);

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Anti-Print Enforcement
  useEffect(() => {
    const handleBeforePrint = (e: Event) => {
      if (data?.shareInfo && !data.shareInfo.allowPrint) {
        e.preventDefault();
        api.logShareAction(token, 'PRINT_BLOCKED', 'Browser print dialog blocked');
        showToast('Printing this document has been disabled by the owner.');
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, [data, token]);

  // Handle Passcode / OTP Submission
  const handleVerifyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    setIsVerifying(true);
    try {
      const isOtp = Boolean(data?.requiresOtp || data?.verificationType === 'OTP' || data?.verificationType === 'EMAIL' || data?.verificationType === 'PHONE');
      const devId = getDeviceId();
      const res = await api.verifySharePasscode(token, verificationCode.trim(), isOtp, devId);
      setData(res);
    } catch (err: any) {
      setVerificationError(err.message || 'Incorrect passcode. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Secure Download Handler
  const handleDownload = async () => {
    if (!data?.document?.decryptedContent) return;
    try {
      await api.downloadSharedDocument(token);

      const link = document.createElement('a');
      link.href = data.document.decryptedContent;
      link.download = data.document.fileName || `${data.document.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      showToast(err.message || 'Downloading is restricted by the vault owner.');
    }
  };

  // 1. CLEAN LOADING STATE
  if (loading) {
    return (
      <div className="min-h-[55vh] flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-300">Opening document...</p>
      </div>
    );
  }

  // 2. EXPIRED / REVOKED / NOT AVAILABLE SCREEN
  const isNoFiles = !data?.document && (!data?.files || data.files.length === 0);
  if (data?.expired || (isNoFiles && !data?.requiresVerification && !data?.requiresPasscode)) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          Document Link Not Available
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {data?.message || 'This document sharing link has expired or access has ended.'}
        </p>

        <button
          onClick={onBackToVault}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to MySpace
        </button>
      </div>
    );
  }

  // 3. PASSCODE / OTP VERIFICATION SCREEN (if configured by owner)
  if (data?.requiresVerification || data?.requiresPasscode) {
    const isOtp = Boolean(data.requiresOtp || data.verificationType === 'OTP' || data.verificationType === 'EMAIL' || data.verificationType === 'PHONE');

    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
          isOtp
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-teal-500/10 border border-teal-500/30 text-teal-400'
        }`}>
          {isOtp ? <ShieldCheck className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
        </div>

        <h2 className="text-lg font-bold text-center text-white">
          {isOtp ? 'One-Time Passcode Required' : 'Security Passcode Required'}
        </h2>
        <p className="text-xs text-slate-400 text-center mt-1">
          {isOtp
            ? 'Enter the 6-digit passcode provided by the document owner to open.'
            : 'This document requires an access passcode to view.'}
        </p>

        {data.documentTitle && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-center">
            <span className="text-slate-400">Document:</span> <strong className="text-white ml-1">{data.documentTitle}</strong>
          </div>
        )}

        {data.passcodeHint && !isOtp && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 text-center">
            <span className="font-semibold">Hint:</span> {data.passcodeHint}
          </div>
        )}

        {data.simulatedOtpHint && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 text-center font-mono font-bold">
            {data.simulatedOtpHint}
          </div>
        )}

        {verificationError && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {verificationError}
          </div>
        )}

        <form onSubmit={handleVerifyAccess} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isOtp ? 'Enter 6-Digit Passcode' : 'Enter Passcode'}
            </label>
            <input
              type={isOtp ? 'text' : 'password'}
              required
              autoFocus
              maxLength={isOtp ? 6 : 24}
              placeholder={isOtp ? '••••••' : 'Passcode'}
              value={verificationCode}
              onChange={e => setVerificationCode(isOtp ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-center text-lg text-white font-mono tracking-widest focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying || !verificationCode}
            className="w-full py-3 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? 'Opening...' : 'Open Document'}
          </button>

          <button
            type="button"
            onClick={onBackToVault}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Cancel and Return
          </button>
        </form>
      </div>
    );
  }

  // 4. DIRECT DOCUMENT VIEWING
  const doc = data?.document;
  const share = data?.shareInfo;
  const timeRemaining = share?.expiresAt ? getTimeRemainingString(share.expiresAt) : { text: 'No Expiry', isExpired: false };
  const catBadge = doc ? getCategoryBadge(doc.category) : null;
  const watermark = share?.watermark;

  const isAudio = Boolean(doc && (isAudioFile(doc.fileType, doc.fileName, doc.category) || doc.decryptedContent?.startsWith('data:audio/')));
  const isImage = Boolean(doc && (doc.fileType?.startsWith('image/') || doc.fileName?.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i) || doc.decryptedContent?.startsWith('data:image/')));
  const isPdf = Boolean(doc && (doc.fileType?.includes('pdf') || doc.fileName?.toLowerCase().endsWith('.pdf') || doc.decryptedContent?.startsWith('data:application/pdf')));
  const isVideo = Boolean(doc && (doc.fileType?.startsWith('video/') || doc.fileName?.match(/\.(mp4|webm|mov|ogg|m4v)$/i) || doc.decryptedContent?.startsWith('data:video/')));

  const canDownload = Boolean(share?.allowDownload || share?.permission === 'DOWNLOAD' || share?.permission === 'VIEW_AND_DOWNLOAD');

  return (
    <div className={`max-w-5xl mx-auto space-y-4 animate-in fade-in duration-200 pb-12 ${
      share?.restrictScreenCapture ? 'select-none' : ''
    }`}>
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToVault}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Return to MySpace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-xs sm:max-w-md">
                {doc?.title || data?.documentTitle || 'Shared Document'}
              </h1>
              {catBadge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catBadge.colorClass}`}>
                  {catBadge.label}
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              {share?.showOwnerName && (share?.ownerName || doc?.ownerName) && (
                <>
                  <span>Shared by {share?.ownerName || doc?.ownerName}</span>
                  <span>•</span>
                </>
              )}
              {doc?.fileName && (
                <>
                  <span>{doc.fileName}</span>
                  <span>•</span>
                </>
              )}
              {doc?.fileSize ? <span>{formatBytes(doc.fileSize)}</span> : null}
            </div>
          </div>
        </div>

        {/* Right side actions & status */}
        <div className="flex items-center gap-3 ml-auto">
          {share?.expiresAt && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>{timeRemaining.text}</span>
            </div>
          )}

          {canDownload ? (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <Eye className="w-3.5 h-3.5 text-teal-400" />
              <span>View Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-File Tab Bar (if shared session has multiple files) */}
      {data?.files && data.files.length > 1 && (
        <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <span className="text-xs font-semibold text-slate-400 px-2 shrink-0">Files ({data.files.length}):</span>
          {data.files.map(f => (
            <button
              key={f.documentId}
              onClick={() => handleSelectMultiFile(f.documentId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                selectedFileId === f.documentId
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <File className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{f.documentTitle}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Direct Document Viewer Frame */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[480px] overflow-hidden">
        {/* Anti-Tamper Watermark Overlay (if enabled by owner) */}
        {watermark?.enabled && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-around select-none opacity-[0.035] rotate-[-22deg] text-slate-100 font-black text-xl sm:text-3xl text-center leading-loose tracking-wider">
            <div>{watermark.customText || 'CONFIDENTIAL – MYSPACE'}</div>
            {watermark.ownerName && <div>OWNER: {watermark.ownerName.toUpperCase()}</div>}
            {watermark.recipientName && <div>RECIPIENT: {watermark.recipientName.toUpperCase()}</div>}
          </div>
        )}

        {loadingFile ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Loading file...</p>
          </div>
        ) : doc?.decryptedContent ? (
          /* 1. PDF Document Direct Viewer */
          isPdf ? (
            <div className="w-full h-[680px] rounded-xl overflow-hidden border border-slate-700 bg-white shadow-lg relative z-10">
              <iframe
                src={doc.decryptedContent}
                className="w-full h-full border-0"
                title={doc.title}
              />
            </div>
          ) : /* 2. Image Document Direct Viewer */
          isImage ? (
            <div className="relative z-10 w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center p-2">
              <img
                src={doc.decryptedContent}
                alt={doc.title}
                className="w-full h-auto object-contain max-h-[580px] rounded-lg"
              />
            </div>
          ) : /* 3. Video Document Direct Player */
          isVideo ? (
            <div className="relative z-10 w-full max-w-3xl rounded-xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
              <video
                src={doc.decryptedContent}
                controls
                playsInline
                className="w-full h-auto max-h-[540px]"
              />
            </div>
          ) : /* 4. Audio Document Direct Player */
          isAudio ? (
            <div className="relative z-10 w-full max-w-xl p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <audio
                ref={audioRef}
                src={doc.decryptedContent}
                onTimeUpdate={() => {
                  if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
                    setAudioDuration(audioRef.current.duration);
                  }
                }}
                onEnded={() => {
                  setIsPlayingAudio(false);
                  setAudioCurrentTime(0);
                }}
              />

              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-teal-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Audio Recording
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {doc.fileName}
                </span>
              </div>

              {/* Waveform Visualizer */}
              <AudioWaveformVisualizer
                isPlaying={isPlayingAudio}
                isPaused={!isPlayingAudio}
                height={60}
              />

              {/* Seek Bar */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 1}
                  step={0.01}
                  value={audioCurrentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setAudioCurrentTime(t);
                    if (audioRef.current) audioRef.current.currentTime = t;
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-teal-300 font-bold">{formatAudioDuration(audioCurrentTime)}</span>
                  <span>{formatAudioDuration(audioDuration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!audioRef.current) return;
                      if (isPlayingAudio) {
                        audioRef.current.pause();
                        setIsPlayingAudio(false);
                      } else {
                        audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
                      }
                    }}
                    className="w-12 h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-lg shadow-teal-950/50"
                  >
                    {isPlayingAudio ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        setAudioCurrentTime(0);
                      }
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Restart audio"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMuted;
                      setIsMuted(next);
                      if (audioRef.current) audioRef.current.volume = next ? 0 : audioVolume;
                    }}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {isMuted || audioVolume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : audioVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAudioVolume(v);
                      if (audioRef.current) audioRef.current.volume = isMuted ? 0 : v;
                    }}
                    className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              </div>
            </div>
          ) : /* 5. Text / Document Viewer */
          !doc.decryptedContent.startsWith('data:') ? (
            <div className="relative z-10 w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl text-slate-200 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto font-sans">
              <div className="text-white font-bold mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>{doc.title}</span>
                <span className="text-xs text-slate-400 font-normal">{doc.fileName}</span>
              </div>
              {doc.decryptedContent}
            </div>
          ) : (
            /* 6. Binary file fallback */
            <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400">
                <File className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{doc.fileName || doc.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{formatBytes(doc.fileSize)} • {doc.fileType}</p>
              </div>
              {canDownload ? (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download File
                </button>
              ) : (
                <p className="text-xs text-slate-400">View-only document</p>
              )}
            </div>
          )
        ) : (
          <div className="py-16 text-center text-slate-400 text-xs">
            Document loaded into secure view.
          </div>
        )}

        {/* Security watermark footer */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Protected by MySpace</span>
          </span>
          {doc?.verifiedIssuer && (
            <>
              <span>•</span>
              <span>Issuer: {doc.verifiedIssuer}</span>
            </>
          )}
          {doc?.documentNumber && (
            <>
              <span>•</span>
              <span>ID: {doc.documentNumber}</span>
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 border border-amber-500/40 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
