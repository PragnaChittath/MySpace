import React, { useState, useRef, useEffect } from 'react';
import {
  ScanFace,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Lock,
  X,
  Sparkles
} from 'lucide-react';
import { faceEngine, LIVENESS_CHALLENGES, LivenessChallenge, FaceAnalysisResult } from '../utils/faceBiometrics.js';
import { api } from '../services/api.js';
import { User } from '../types.js';

interface FaceVerificationModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onSuccess: (authData: { user: User; token: string; similarity: number }) => void;
  onFallbackToMfa: () => void;
  onClose?: () => void;
}

export function FaceVerificationModal({
  userId,
  userName,
  isOpen,
  onSuccess,
  onFallbackToMfa,
  onClose
}: FaceVerificationModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [step, setStep] = useState<'POSITION' | 'LIVENESS' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('POSITION');

  const [activeChallenge, setActiveChallenge] = useState<LivenessChallenge>(LIVENESS_CHALLENGES[0]);
  const [livenessProgress, setLivenessProgress] = useState<number>(0);
  const [analysis, setAnalysis] = useState<FaceAnalysisResult>({
    faceDetected: false,
    faceCentered: false,
    lightingQuality: 'POOR',
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    eyeAspectRatio: 0.28,
    mouthAspectRatio: 0.32,
    faceBounds: { x: 0, y: 0, width: 0, height: 0 },
    livenessScore: 0
  });

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setHasPermission(true);
          setStep('POSITION');
          faceEngine.resetLiveness();
        };
      }
    } catch (err: any) {
      console.error('Face verification camera error:', err);
      setHasPermission(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. You can switch to password + OTP verification.'
          : 'Camera device unavailable.'
      );
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('POSITION');
      setLivenessProgress(0);
      setVerificationError(null);
      setSimilarityScore(null);
      setIsVerifying(false);
      const randomChallenge = LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
      setActiveChallenge(randomChallenge);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Frame processing
  useEffect(() => {
    if (!isOpen || !hasPermission || step === 'SUCCESS' || step === 'VERIFYING' || isLocked) return;

    let centeredCount = 0;

    const processFrame = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = faceEngine.analyzeFrame(videoRef.current, activeChallenge.type);
        setAnalysis(result);

        if (step === 'POSITION') {
          if (result.faceDetected && result.faceCentered) {
            centeredCount++;
            if (centeredCount > 10) {
              setStep('LIVENESS');
              faceEngine.resetLiveness();
            }
          } else {
            centeredCount = Math.max(0, centeredCount - 1);
          }
        } else if (step === 'LIVENESS') {
          setLivenessProgress(prev => {
            const target = Math.min(100, Math.round(result.livenessScore * 100));
            const next = Math.max(prev, target);
            if (next >= 100 && !isVerifying) {
              handleVerifyBiometricProbe(result);
            }
            return next;
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, hasPermission, step, activeChallenge, isVerifying, isLocked]);

  const handleVerifyBiometricProbe = async (latestAnalysis: FaceAnalysisResult) => {
    if (!videoRef.current || isVerifying) return;
    setIsVerifying(true);
    setStep('VERIFYING');

    try {
      const probeEmbedding = faceEngine.generateBiometricEmbedding(videoRef.current, latestAnalysis.faceBounds);
      const res = await api.verifyFace(userId, probeEmbedding, true);

      setSimilarityScore(res.similarity);
      setStep('SUCCESS');
      stopCamera();

      setTimeout(() => {
        onSuccess({
          user: res.user,
          token: res.token,
          similarity: res.similarity
        });
      }, 1200);
    } catch (err: any) {
      console.error('Face verification failed:', err);
      setIsVerifying(false);
      setStep('FAILED');
      setSimilarityScore(err.similarity || 0);
      setVerificationError(err.message || 'Facial signature does not match enrolled biometric template.');
      if (err.remainingAttempts !== undefined) {
        setRemainingAttempts(err.remainingAttempts);
      }
      if (err.locked || err.requiresMfaFallback) {
        setIsLocked(true);
      }
    }
  };

  const handleRetry = () => {
    setVerificationError(null);
    setStep('POSITION');
    setLivenessProgress(0);
    faceEngine.resetLiveness();
    const randomChallenge = LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
    setActiveChallenge(randomChallenge);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Facial Biometric Verification</h2>
              <p className="text-xs text-slate-400">
                Verifying identity for {userName || 'Account User'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Video / Camera Scanner Frame */}
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Biometric Scanning Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`relative w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${
                  step === 'SUCCESS'
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                    : step === 'FAILED'
                    ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                    : step === 'VERIFYING'
                    ? 'border-blue-400 animate-pulse'
                    : analysis.faceCentered
                    ? 'border-blue-500'
                    : 'border-slate-500/60 border-dashed'
                }`}
              >
                {/* Laser scan line when verifying */}
                {step === 'VERIFYING' && (
                  <div className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-scan" />
                )}
              </div>
            </div>

            {/* Status indicators */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
              <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-200">
                <Lock className="w-3 h-3 text-blue-400" />
                <span>AES-256 Cosine Match</span>
              </div>

              {similarityScore !== null && (
                <div
                  className={`flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-full border font-mono ${
                    similarityScore >= 80
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-red-950/80 border-red-500/50 text-red-300'
                  }`}
                >
                  <span>{similarityScore}% Match</span>
                </div>
              )}
            </div>

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-sm font-medium text-slate-200 mb-2">Camera Unavailable</p>
                <p className="text-xs text-slate-400 mb-4 max-w-xs">{cameraError}</p>
                <button
                  onClick={onFallbackToMfa}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  Use Password + OTP Instead
                </button>
              </div>
            )}

            {/* Success Overlay */}
            {step === 'SUCCESS' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Identity Verified!</h3>
                <p className="text-xs text-emerald-400 font-mono">
                  {similarityScore}% Biometric Match • Access Granted
                </p>
              </div>
            )}
          </div>

          {/* Interactive Instruction Box */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            {step === 'POSITION' && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <ScanFace className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Look Directly at the Camera</h4>
                  <p className="text-xs text-slate-400">Position your face inside the circle to begin verification.</p>
                </div>
              </div>
            )}

            {step === 'LIVENESS' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <div>
                      <h4 className="text-xs font-semibold text-blue-300">
                        {activeChallenge.instruction}
                      </h4>
                      <p className="text-[11px] text-slate-400">{activeChallenge.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium text-blue-400">{livenessProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150 ease-out"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              </div>
            )}

            {step === 'VERIFYING' && (
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Matching Biometric Signatures...</h4>
                  <p className="text-xs text-slate-400">Comparing cryptographic feature vectors in vault security core.</p>
                </div>
              </div>
            )}

            {step === 'FAILED' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-red-300 bg-red-950/40 border border-red-800/50 p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-200">Verification Failed</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{verificationError}</p>
                    {remainingAttempts > 0 && !isLocked && (
                      <p className="text-amber-400 text-[11px] mt-1">
                        {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before security lock.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <button
                      onClick={handleRetry}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Face Scan Again
                    </button>
                  )}
                  <button
                    onClick={onFallbackToMfa}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Verify with OTP
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with secure fallback option */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Multi-Factor Biometric Defense</span>
          </div>

          <button
            onClick={onFallbackToMfa}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Use Password + OTP fallback
          </button>
        </div>
      </div>
    </div>
  );
}
