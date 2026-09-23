import React, { useState, useRef, useEffect } from 'react';
import {
  ScanFace,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Eye,
  Lock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { faceEngine, LIVENESS_CHALLENGES, LivenessChallenge, FaceAnalysisResult } from '../utils/faceBiometrics.js';
import { api } from '../services/api.js';
import { User } from '../types.js';

interface FaceRegistrationModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  isInitialSetup?: boolean; // When called right after Sign Up
}

export function FaceRegistrationModal({
  userId,
  userName,
  isOpen,
  onClose,
  onSuccess,
  isInitialSetup = false
}: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [step, setStep] = useState<'PERMISSION' | 'POSITION' | 'LIVENESS' | 'CAPTURING' | 'SUCCESS'>('PERMISSION');

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

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Start Camera
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
      console.error('Camera access error:', err);
      setHasPermission(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser to enable Face Recognition.'
          : 'Unable to access video device. Please ensure a webcam is connected.'
      );
    }
  };

  // Stop Camera
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
      setStep('PERMISSION');
      setLivenessProgress(0);
      setServerError(null);
      // Pick a random liveness challenge
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

  // Real-time Video Analysis Loop
  useEffect(() => {
    if (!isOpen || !hasPermission || step === 'SUCCESS' || step === 'CAPTURING') return;

    let consecutiveCenteredFrames = 0;

    const processFrame = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = faceEngine.analyzeFrame(videoRef.current, activeChallenge.type);
        setAnalysis(result);

        if (step === 'POSITION') {
          if (result.faceDetected && result.faceCentered && result.lightingQuality !== 'POOR') {
            consecutiveCenteredFrames++;
            if (consecutiveCenteredFrames > 15) {
              setStep('LIVENESS');
              faceEngine.resetLiveness();
            }
          } else {
            consecutiveCenteredFrames = Math.max(0, consecutiveCenteredFrames - 1);
          }
        } else if (step === 'LIVENESS') {
          setLivenessProgress(prev => {
            const target = Math.min(100, Math.round(result.livenessScore * 100));
            const next = Math.max(prev, target);
            if (next >= 100 && !isProcessing) {
              handleEnrollBiometrics(result);
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
  }, [isOpen, hasPermission, step, activeChallenge, isProcessing]);

  // Enroll captured embedding to server
  const handleEnrollBiometrics = async (latestAnalysis: FaceAnalysisResult) => {
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);
    setStep('CAPTURING');

    try {
      // Extract 128-dimensional unit vector
      const embedding = faceEngine.generateBiometricEmbedding(videoRef.current, latestAnalysis.faceBounds);

      // Submit to backend for AES-256-GCM encryption & persistent enrollment
      const response = await api.registerFace(userId, embedding, true);

      setStep('SUCCESS');
      setTimeout(() => {
        onSuccess(response.user);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Biometric enrollment error:', err);
      setServerError(err.message || 'Failed to enroll facial signature');
      setStep('POSITION');
      setIsProcessing(false);
      faceEngine.resetLiveness();
      setLivenessProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isInitialSetup ? 'Step 2: Set Up Face Recognition' : 'Enrolling Facial Recognition'}
              </h2>
              <p className="text-xs text-slate-400">
                Encrypted mathematical biometric template • Zero-knowledge storage
              </p>
            </div>
          </div>
          {!isInitialSetup && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Camera Stream / Video Container */}
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Biometric Oval Framing Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`relative w-48 h-60 rounded-[50%] border-2 transition-all duration-300 ${
                  step === 'SUCCESS'
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]'
                    : step === 'LIVENESS'
                    ? 'border-blue-400 shadow-[0_0_25px_rgba(96,165,250,0.3)] animate-pulse'
                    : analysis.faceCentered
                    ? 'border-emerald-500'
                    : 'border-slate-500/60 border-dashed'
                }`}
              >
                {/* Crosshair Guides */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-4 h-0.5 bg-blue-400/80"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-4 h-0.5 bg-blue-400/80"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-0.5 h-4 bg-blue-400/80"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-0.5 h-4 bg-blue-400/80"></div>
              </div>
            </div>

            {/* Status Pill Badge at Top of Camera */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    analysis.lightingQuality === 'GOOD'
                      ? 'bg-emerald-400'
                      : analysis.lightingQuality === 'FAIR'
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                  }`}
                />
                <span>Lighting: {analysis.lightingQuality}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-200">
                <Lock className="w-3 h-3 text-blue-400" />
                <span>AES-256 Vector</span>
              </div>
            </div>

            {/* Error Overlay if Camera Fails */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-sm font-medium text-slate-200 mb-2">Camera Access Required</p>
                <p className="text-xs text-slate-400 mb-4 max-w-xs">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            )}

            {/* Success Animation Overlay */}
            {step === 'SUCCESS' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3">
                  <CheckCircle2 className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Face Recognition Enrolled!</h3>
                <p className="text-xs text-slate-300">Biometric template encrypted and saved to your security profile.</p>
              </div>
            )}
          </div>

          {/* Real-time Guidance Banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            {step === 'POSITION' && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <ScanFace className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Step 1: Align Face</h4>
                  <p className="text-xs text-slate-400">
                    {analysis.faceCentered
                      ? 'Hold still inside the guide oval...'
                      : 'Position your face clearly within the oval frame in good lighting.'}
                  </p>
                </div>
              </div>
            )}

            {step === 'LIVENESS' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <div>
                      <h4 className="text-xs font-semibold text-blue-300">
                        Liveness Check: {activeChallenge.instruction}
                      </h4>
                      <p className="text-[11px] text-slate-400">{activeChallenge.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium text-blue-400">{livenessProgress}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150 ease-out"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              </div>
            )}

            {step === 'CAPTURING' && (
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Encrypting Biometric Vector</h4>
                  <p className="text-xs text-slate-400">
                    Computing 128-d normalized embeddings with AES-256-GCM AEAD encryption...
                  </p>
                </div>
              </div>
            )}

            {serverError && (
              <div className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}
          </div>

          {/* Privacy & Zero-Knowledge Note */}
          <div className="flex items-start gap-2.5 px-1 text-[11px] text-slate-400 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-300 font-medium">Privacy Guaranteed:</strong> MySpace never saves or uploads raw photos. Only an irreversible, encrypted 128-dimensional mathematical vector is stored at rest.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          {isInitialSetup ? (
            <button
              onClick={() => {
                onClose();
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Skip for now (configure later in Security Settings)
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'LIVENESS' && (
            <button
              onClick={() => {
                const nextIdx = (LIVENESS_CHALLENGES.indexOf(activeChallenge) + 1) % LIVENESS_CHALLENGES.length;
                setActiveChallenge(LIVENESS_CHALLENGES[nextIdx]);
                faceEngine.resetLiveness();
                setLivenessProgress(0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Different Challenge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
