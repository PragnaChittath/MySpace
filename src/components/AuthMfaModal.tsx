import React, { useState, type FormEvent } from 'react';
import {
  X,
  Lock,
  KeyRound,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ScanFace
} from 'lucide-react';
import { User } from '../types.js';
import { api } from '../services/api.js';

interface AuthMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  onOpenFaceVerification?: (userId: string, userName: string, fallbackOtp: string) => void;
  onOpenFaceRegistration?: (user: User, token: string) => void;
}

export function AuthMfaModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenFaceVerification,
  onOpenFaceRegistration
}: AuthMfaModalProps) {
  const [mode, setMode] = useState<'LOGIN' | 'MFA_CHALLENGE' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Personal / General');
  const [otpCode, setOtpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [pendingUserName, setPendingUserName] = useState('');
  const [sampleOtp, setSampleOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleInitialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'REGISTER') {
        const res = await api.register({
          name: name.trim() || 'Vault User',
          email: email.trim(),
          password,
          department
        });

        // If newly registered, transition to Face Registration flow
        if (onOpenFaceRegistration && res.user && res.token) {
          onOpenFaceRegistration(res.user, res.token);
          onClose();
        } else if (res.user && res.token) {
          onLoginSuccess(res.user, res.token);
          onClose();
        } else {
          setPendingUserId(res.userId);
          setSampleOtp(res.sampleOtp || '123456');
          setMode('MFA_CHALLENGE');
        }
      } else {
        const res = await api.login({ email: email.trim(), password });

        // Check if user requires Facial Recognition
        if ((res as any).requiresFaceAuth && onOpenFaceVerification) {
          onOpenFaceVerification(res.userId, (res as any).name || 'User', (res as any).sampleOtp || '');
          onClose();
          return;
        }

        if (res.requiresMfa) {
          setPendingUserId(res.userId);
          setPendingUserName((res as any).name || '');
          setSampleOtp(res.sampleOtp || '');
          setMode('MFA_CHALLENGE');
        } else if ((res as any).user && (res as any).token) {
          onLoginSuccess((res as any).user, (res as any).token);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.verifyMfa({
        userId: pendingUserId,
        otpCode: otpCode || sampleOtp
      });
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid MFA code entered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              {mode === 'REGISTER' ? <ScanFace className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {mode === 'MFA_CHALLENGE' ? 'Two-Factor Authentication' : mode === 'REGISTER' ? 'Register MySpace Account' : 'Sign In to MySpace'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'MFA_CHALLENGE' ? 'Step 2: Enter your 6-digit OTP security code' : mode === 'REGISTER' ? 'Sign up & setup face recognition biometric ID' : 'Password + Facial recognition zero-knowledge vault'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'MFA_CHALLENGE' ? (
          /* MFA OTP Screen */
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 text-center space-y-2">
              <Smartphone className="w-8 h-8 mx-auto text-blue-400 animate-bounce" />
              <div className="text-xs text-blue-200">
                OTP security code generated for your device:
              </div>
              <div className="text-2xl font-mono font-black text-white tracking-widest bg-slate-900/80 py-1.5 px-4 rounded-xl border border-slate-800 inline-block">
                {sampleOtp}
              </div>
              <button
                type="button"
                onClick={() => setOtpCode(sampleOtp)}
                className="block mx-auto text-[11px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                Click to autofill code
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="849201"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-center font-mono text-xl tracking-widest text-blue-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating MFA...' : 'Verify OTP & Enter Vault'}
            </button>

            <button
              type="button"
              onClick={() => setMode('LOGIN')}
              className="w-full py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Back to Login
            </button>
          </form>
        ) : (
          /* Login / Register Form */
          <form onSubmit={handleInitialAuth} className="mt-5 space-y-4">
            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Vance"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="user@myspace.vault"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {mode === 'REGISTER' ? 'Create Master Vault Password (min 6 characters)' : 'Master Vault Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Processing...'
              ) : mode === 'REGISTER' ? (
                <>
                  <ScanFace className="w-4 h-4" />
                  Continue to Face Registration
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Sign In to Vault
                </>
              )}
            </button>

            {mode === 'LOGIN' && (
              <button
                type="button"
                onClick={() => {
                  setEmail('demo@myspace.vault');
                  setPassword('MySpace2026!');
                }}
                className="w-full py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Fill Demo Credentials (demo@myspace.vault)
              </button>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {mode === 'LOGIN' ? "New user? Sign up & setup biometric face ID" : 'Already registered? Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
