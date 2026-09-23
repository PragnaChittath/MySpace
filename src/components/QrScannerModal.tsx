import React, { useState, type FormEvent } from 'react';
import {
  X,
  QrCode,
  Camera,
  Search,
  ExternalLink,
  Lock,
  Flame,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ShareLink } from '../types.js';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: string) => void;
  availableShares: ShareLink[];
}

export function QrScannerModal({
  isOpen,
  onClose,
  onSelectToken,
  availableShares
}: QrScannerModalProps) {
  const [manualToken, setManualToken] = useState('');
  const [activeTab, setActiveTab] = useState<'scan' | 'paste' | 'quick'>('paste');

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    // Extract token if user pasted full URL
    let token = manualToken.trim();
    if (token.includes('/share/')) {
      token = token.split('/share/')[1].split('?')[0];
    }
    onSelectToken(token);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">QR Code Scanner & Receiver</h2>
              <p className="text-xs text-slate-400">Scan or paste a secure share token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex mt-4 p-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'paste' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Paste Token / URL
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'scan' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Camera Scanner
          </button>
          {availableShares.length > 0 && (
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'quick' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Shares ({availableShares.length})
            </button>
          )}
        </div>

        {/* Tab 1: Active Shares List if any exist */}
        {activeTab === 'quick' && (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-slate-400">
              Select one of your active shares to simulate receiver verification:
            </div>

            {availableShares.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No active share tokens created yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availableShares.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectToken(s.token);
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {s.documentTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                        <span>Token: {s.token.substring(0, 10)}...</span>
                        <span>•</span>
                        <span className={s.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Paste URL or Token */}
        {activeTab === 'paste' && (
          <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Enter QR Token or Full Share URL
              </label>
              <input
                type="text"
                required
                placeholder="e.g. token_sec_991823... or https://.../share/token_xxx"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 transition-colors cursor-pointer"
            >
              Open Shared Document
            </button>
          </form>
        )}

        {/* Tab 3: Camera Scanner Simulator */}
        {activeTab === 'scan' && (
          <div className="mt-4 space-y-4 text-center">
            <div className="relative w-full h-48 rounded-2xl bg-slate-950 border-2 border-dashed border-cyan-500/40 flex flex-col items-center justify-center overflow-hidden">
              {/* Scanning reticle */}
              <div className="w-32 h-32 border-2 border-cyan-400 rounded-xl relative animate-pulse flex items-center justify-center">
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce"></div>
                <Camera className="w-8 h-8 text-cyan-400/60" />
              </div>
              <div className="text-[11px] text-cyan-300 font-mono mt-2">
                Point physical camera or device screen at QR code
              </div>
            </div>

            {availableShares.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSelectToken(availableShares[0].token);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
              >
                Simulate Camera Capture on Demo QR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
