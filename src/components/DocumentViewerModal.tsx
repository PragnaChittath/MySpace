import { useState, useRef, useEffect, ChangeEvent } from 'react';
import {
  X,
  Lock,
  Download,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Tag,
  FileText,
  Clock,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FileAudio,
  Repeat,
  ArrowUpRight
} from 'lucide-react';
import { VaultDocument } from '../types.js';
import {
  formatBytes,
  formatDate,
  getExpiryStatus,
  getCategoryBadge,
  getSensitivityBadge,
  formatAudioDuration,
  isAudioFile
} from '../utils/formatters.js';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer.js';

interface DocumentViewerModalProps {
  document: VaultDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateQr: (doc: VaultDocument) => void;
  onShareDirect?: (doc: VaultDocument) => void;
}

export function DocumentViewerModal({
  document: doc,
  isOpen,
  onClose,
  onGenerateQr,
  onShareDirect
}: DocumentViewerModalProps) {
  const [downloading, setDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (doc?.audioDurationSeconds) {
      setDuration(doc.audioDurationSeconds);
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const isAudio = isAudioFile(doc.fileType, doc.fileName, doc.category);
  const isImage = Boolean((doc.fileType && doc.fileType.startsWith('image/')) ||
    (doc.fileName && /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(doc.fileName)) ||
    (doc.decryptedPreviewData && doc.decryptedPreviewData.startsWith('data:image/')));
  const isPdf = Boolean((doc.fileType && doc.fileType.includes('pdf')) ||
    (doc.fileName && /\.pdf$/i.test(doc.fileName)) ||
    (doc.decryptedPreviewData && doc.decryptedPreviewData.startsWith('data:application/pdf')));
  const isVideo = Boolean((doc.fileType && doc.fileType.startsWith('video/')) ||
    (doc.fileName && /\.(mp4|webm|mov|ogg|m4v)$/i.test(doc.fileName)) ||
    (doc.decryptedPreviewData && doc.decryptedPreviewData.startsWith('data:video/')));
  const catBadge = getCategoryBadge(doc.category);
  const sensBadge = getSensitivityBadge(doc.sensitivity);
  const expBadge = getExpiryStatus(doc.expiryDate);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Audio play error:', err));
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : vol;
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    try {
      const content = doc.decryptedPreviewData || '';
      const link = document.createElement('a');
      link.href = content;
      link.download = doc.fileName || (isAudio ? `${doc.title}.mp3` : `${doc.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloading(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">{doc.title}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sensBadge.colorClass}`}>
                  {sensBadge.label.split(' ')[0]}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{doc.fileName}</span>
                <span>•</span>
                <span>{formatBytes(doc.fileSize)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onGenerateQr(doc)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
              title="Configure Secure Sharing & QR"
            >
              <QrCode className="w-3.5 h-3.5" />
              Share Document
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Document Preview on Left, Metadata on Right */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-y-auto">
          {/* Main Document Preview Container */}
          <div className="lg:col-span-2 p-6 bg-slate-950 flex flex-col items-center justify-center relative min-h-[380px] overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
            {/* Dynamic Security Anti-Tamper Watermark Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none opacity-[0.035] rotate-[-25deg] text-slate-100 font-black text-3xl sm:text-5xl text-center leading-tight">
              MYSPACE
              <br />
              CONFIDENTIAL
              <br />
              AUTHORIZED PREVIEW
            </div>

            {/* Audio or Document Render (Audio, SVG, Image, Text) */}
            {isAudio ? (
              <div className="relative z-10 w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
                <audio
                  ref={audioRef}
                  src={doc.decryptedPreviewData || ''}
                  onTimeUpdate={() => {
                    if (audioRef.current) {
                      setCurrentTime(audioRef.current.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
                      setDuration(audioRef.current.duration);
                    }
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                />

                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Voice & Audio Player</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    DECRYPTED & AUTHENTIC
                  </span>
                </div>

                {/* Animated Waveform */}
                <AudioWaveformVisualizer
                  isPlaying={isPlaying}
                  isPaused={!isPlaying}
                  height={56}
                />

                {/* Seek Bar & Timers */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || doc.audioDurationSeconds || 1}
                    step={0.01}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span className="text-violet-300 font-bold">{formatAudioDuration(currentTime)}</span>
                    <span>{formatAudioDuration(duration || doc.audioDurationSeconds)}</span>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-11 h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer shadow-md shadow-violet-950/50"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = 0;
                          setCurrentTime(0);
                        }
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Restart"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Playback speed selector */}
                  <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px] font-bold">
                    {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          playbackRate === speed ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
                    />
                  </div>
                </div>
              </div>
            ) : doc.decryptedPreviewData ? (
              isImage ? (
                <div className="relative z-10 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900">
                  <img
                    src={doc.decryptedPreviewData}
                    alt={doc.title}
                    className="w-full h-auto object-contain max-h-[420px]"
                  />
                </div>
              ) : isPdf ? (
                <div className="relative z-10 w-full h-[450px] rounded-xl overflow-hidden border border-slate-700 bg-white">
                  <iframe
                    src={doc.decryptedPreviewData}
                    className="w-full h-full border-0"
                    title={doc.title}
                  />
                </div>
              ) : isVideo ? (
                <div className="relative z-10 w-full max-w-lg rounded-xl overflow-hidden border border-slate-700 bg-black">
                  <video
                    src={doc.decryptedPreviewData}
                    controls
                    className="w-full h-auto max-h-[420px]"
                  />
                </div>
              ) : (
                <div className="relative z-10 w-full max-w-lg p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-xl font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-[380px] overflow-y-auto">
                  <div className="text-teal-400 font-bold mb-3 border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>{doc.title}</span>
                    <span className="text-[10px] text-slate-400">{doc.fileType}</span>
                  </div>
                  {doc.decryptedPreviewData.startsWith('data:') ? (
                    <div className="text-slate-400">
                      Protected document file: {doc.fileName} ({formatBytes(doc.fileSize)})
                    </div>
                  ) : (
                    doc.decryptedPreviewData
                  )}
                </div>
              )
            ) : (
              <div className="text-center text-slate-400 text-xs">
                Document preview loaded securely.
              </div>
            )}

            {/* Bottom Security Notice */}
            <div className="mt-4 text-center text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Protected in secure MySpace storage.</span>
            </div>
          </div>

          {/* Right Sidebar Metadata */}
          <div className="p-5 space-y-4 bg-slate-900/60 overflow-y-auto text-xs">
            {/* Category & Status Badges */}
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Classification</div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${catBadge.colorClass}`}>
                  {catBadge.label}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${expBadge.colorClass}`}>
                  {expBadge.label}
                </span>
              </div>
            </div>

            {/* Document Details List */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              {doc.documentNumber && (
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Document / ID Number:</span>
                  <span className="font-mono text-sm font-bold text-teal-300">{doc.documentNumber}</span>
                </div>
              )}

              {doc.verifiedIssuer && (
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Issuing Authority:</span>
                  <div className="flex items-center gap-1.5 text-white font-medium mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{doc.verifiedIssuer}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Issue Date:</span>
                  <span className="text-slate-200 font-medium">{formatDate(doc.issueDate)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Expiry Date:</span>
                  <span className="text-slate-200 font-medium">{formatDate(doc.expiryDate)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-semibold block">Owner:</span>
                <span className="text-slate-200">{doc.ownerName}</span>
              </div>

              {doc.tags && doc.tags.length > 0 && (
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {doc.notes && (
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Notes:</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 mt-1">
                    {doc.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>MySpace Verified</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onShareDirect && (
              <button
                onClick={() => onShareDirect(doc)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-md transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                ↗ Share Directly
              </button>
            )}

            <button
              onClick={() => onGenerateQr(doc)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-md transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              ▣ Share via QR
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Downloading...' : 'Download File'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
