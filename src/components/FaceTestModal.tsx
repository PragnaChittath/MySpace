import React, { useState, useRef, useEffect } from 'react';
import {
  ScanFace,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
  Gauge
} from 'lucide-react';
import { faceEngine, LIVENESS_CHALLENGES, LivenessChallenge, FaceAnalysisResult } from '../utils/faceBiometrics.js';
import { api } from '../services/api.js';

interface FaceTestModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FaceTestModal({ userId, isOpen, onClose }: FaceTestModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    verified: boolean;
    similarity: number;
    threshold: number;
    message: string;
  } | null>(null);

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
        };
      }
    } catch (err: any) {
      console.error('Test camera error:', err);
      setHasPermission(false);
      setCameraError('Camera access unavailable. Please grant browser camera permissions.');
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
      setTestResult(null);
      setIsTesting(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !hasPermission) return;

    const processFrame = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = faceEngine.analyzeFrame(videoRef.current, 'BLINK');
        setAnalysis(result);
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, hasPermission]);

  const handleRunBiometricTest = async () => {
    if (!videoRef.current || isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const probeEmbedding = faceEngine.generateBiometricEmbedding(videoRef.current, analysis.faceBounds);
      const res = await api.testFace(userId, probeEmbedding, true);
      setTestResult(res);
    } catch (err: any) {
      console.error('Test failed:', err);
      setTestResult({
        verified: false,
        similarity: 0,
        threshold: 80.0,
        message: err.message || 'Face test failed.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Biometric Diagnostic Test</h2>
              <p className="text-xs text-slate-400">Live Cosine Similarity & Threshold Evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Target Oval */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${
                  testResult?.verified
                    ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.4)]'
                    : testResult && !testResult.verified
                    ? 'border-red-400'
                    : analysis.faceCentered
                    ? 'border-blue-400'
                    : 'border-slate-500/50 border-dashed'
                }`}
              />
            </div>

            {/* Status pills */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
              <div className="bg-slate-900/85 px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-200">
                Lighting: {analysis.lightingQuality}
              </div>
              <div className="bg-slate-900/85 px-2.5 py-1 rounded-full border border-slate-700/60 text-slate-200">
                Yaw: {analysis.headPose.yaw}°
              </div>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-400">{cameraError}</p>
              </div>
            )}
          </div>

          {/* Test Action / Result */}
          {testResult ? (
            <div
              className={`p-4 rounded-xl border ${
                testResult.verified
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/30 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {testResult.verified ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-sm font-semibold">
                    {testResult.verified ? 'Match Confirmed' : 'Match Below Threshold'}
                  </span>
                </div>
                <span className="text-base font-mono font-bold">
                  {testResult.similarity}% Match
                </span>
              </div>
              <p className="text-xs text-slate-300">{testResult.message}</p>
              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                Similarity: {testResult.similarity}% | Threshold: 80.0% | Status: {testResult.verified ? 'AUTHENTICATED' : 'REJECTED'}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
              Position your face in the oval and click <strong>Run Scan</strong> to calculate your live biometric match percentage against the stored AES-256-GCM template.
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunBiometricTest}
              disabled={isTesting || !hasPermission}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing Biometrics...
                </>
              ) : (
                <>
                  <ScanFace className="w-4 h-4" />
                  {testResult ? 'Test Again' : 'Run Live Biometric Scan'}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
