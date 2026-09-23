import React, { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import {
  X,
  Upload,
  Camera,
  Video,
  Mic,
  Clipboard,
  FileText,
  Lock,
  Calendar,
  Tag,
  Shield,
  CheckCircle2,
  AlertCircle,
  FolderUp,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowLeft,
  FileAudio,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Trash2,
  Plus,
  Radio,
  ExternalLink,
  ChevronRight,
  Clock
} from 'lucide-react';
import { DocumentCategory, SensitivityLevel, User, VaultDocument } from '../types.js';
import { formatBytes, formatAudioDuration } from '../utils/formatters.js';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer.js';
import { useTranslation } from '../i18n/LanguageContext.js';

interface UploadNewModalProps {
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: VaultDocument) => void;
  onBatchUploadSuccess?: (newDocs: VaultDocument[]) => void;
}

type ModalOption = 'SELECTION' | 'DEVICE' | 'CAMERA' | 'VOICE' | 'PASTE';

interface StagedFile {
  id: string;
  file: File;
  name: string;
  title: string;
  size: number;
  type: string;
  category: DocumentCategory;
  sensitivity: SensitivityLevel;
  contentDataUrl: string;
  audioDurationSeconds?: number;
  tags: string[];
  notes: string;
  documentNumber?: string;
  expiryDate?: string;
}

const CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: 'IDENTITY', label: 'Identity & IDs' },
  { id: 'EDUCATION', label: 'Education & Marksheets' },
  { id: 'EMPLOYMENT', label: 'Career & Internships' },
  { id: 'MEDICAL', label: 'Medical & Health' },
  { id: 'FINANCIAL', label: 'PAN & Financial' },
  { id: 'LEGAL', label: 'Legal & Certificates' },
  { id: 'VOICE_AUDIO', label: '🎙️ Voice & Audio' },
  { id: 'OTHER', label: 'General / Other' }
];

function detectCategory(fileName: string, mimeType: string): DocumentCategory {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|webm|weba)$/i.test(lowerName)) {
    return 'VOICE_AUDIO';
  }
  if (/(aadhaar|aadhar|pan|passport|voter|license|licence|id[-_ ]card|ssn|driving|national[-_ ]id)/i.test(lowerName)) {
    return 'IDENTITY';
  }
  if (/(marksheet|degree|diploma|grade|transcript|certificate|course|resume|cv|internship|school|college|university)/i.test(lowerName)) {
    return 'EDUCATION';
  }
  if (/(salary|pay[-_ ]stub|payslip|tax|itr|w2|bank|statement|invoice|receipt|financial|audit|balance)/i.test(lowerName)) {
    return 'FINANCIAL';
  }
  if (/(medical|prescription|hospital|blood|vaccine|health|doctor|report|lab|diagnosis|rx)/i.test(lowerName)) {
    return 'MEDICAL';
  }
  if (/(contract|deed|agreement|affidavit|legal|court|policy|nda|patent|trademark|terms)/i.test(lowerName)) {
    return 'LEGAL';
  }
  if (/(offer[-_ ]letter|employment|appointment|relieving|experience[-_ ]letter)/i.test(lowerName)) {
    return 'EMPLOYMENT';
  }
  return 'OTHER';
}

function getFileIcon(type: string, name: string) {
  const lower = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(lower)) {
    return <FileImage className="w-5 h-5 text-emerald-400" />;
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(lower)) {
    return <FileVideo className="w-5 h-5 text-purple-400" />;
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/i.test(lower)) {
    return <FileAudio className="w-5 h-5 text-amber-400" />;
  }
  if (/\.(xlsx?|csv|tsv)$/i.test(lower)) {
    return <FileSpreadsheet className="w-5 h-5 text-teal-400" />;
  }
  if (/\.(zip|tar|gz|7z|rar)$/i.test(lower)) {
    return <FileArchive className="w-5 h-5 text-indigo-400" />;
  }
  if (/\.(json|js|ts|html|css|py|java|cpp|c|sh)$/i.test(lower)) {
    return <FileCode className="w-5 h-5 text-pink-400" />;
  }
  return <FileText className="w-5 h-5 text-blue-400" />;
}

export function UploadNewModal({
  currentUser,
  isOpen,
  onClose,
  onUploadSuccess,
  onBatchUploadSuccess
}: UploadNewModalProps) {
  const { t } = useTranslation();
  const [activeOption, setActiveOption] = useState<ModalOption>('SELECTION');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setActiveOption('SELECTION');
      setErrorMsg('');
      setIsEncrypting(false);
      setUploadProgressText('');
      setUploadProgressPercent(0);
      setStagedFiles([]);
      stopCamera();
      stopVoiceRecording();
    } else {
      stopCamera();
      stopVoiceRecording();
    }
  }, [isOpen]);

  // --------------------------------------------------------------------------
  // OPTION 1: Upload from Device (Multiple Files Supported)
  // --------------------------------------------------------------------------
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const deviceFileInputRef = useRef<HTMLInputElement>(null);

  const processSelectedFiles = async (files: FileList | File[]) => {
    setErrorMsg('');
    const newStaged: StagedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 100 * 1024 * 1024) {
        setErrorMsg(`File "${f.name}" exceeds 100 MB limit and was skipped.`);
        continue;
      }

      // Read file data URL
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(f);
        });

        const category = detectCategory(f.name, f.type || '');
        const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        let audioDurationSeconds: number | undefined = undefined;
        if (f.type.startsWith('audio/') || category === 'VOICE_AUDIO') {
          try {
            const tempAudio = new Audio(dataUrl);
            await new Promise(r => {
              tempAudio.onloadedmetadata = () => {
                if (tempAudio.duration && isFinite(tempAudio.duration)) {
                  audioDurationSeconds = tempAudio.duration;
                }
                r(true);
              };
              tempAudio.onerror = () => r(false);
            });
          } catch (e) {}
        }

        newStaged.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: f,
          name: f.name,
          title: cleanTitle,
          size: f.size,
          type: f.type || 'application/octet-stream',
          category,
          sensitivity: 'CONFIDENTIAL',
          contentDataUrl: dataUrl,
          audioDurationSeconds,
          tags: [category.toLowerCase()],
          notes: ''
        });
      } catch (err: any) {
        console.error('File read error:', err);
      }
    }

    setStagedFiles(prev => [...prev, ...newStaged]);
    if (newStaged.length > 0 && activeOption === 'SELECTION') {
      setActiveOption('DEVICE');
    }
  };

  const handleDeviceFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(e.target.files);
    }
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateStagedFile = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleUploadAllStaged = async () => {
    if (stagedFiles.length === 0) {
      setErrorMsg('Please select at least one file to upload.');
      return;
    }

    setIsEncrypting(true);
    setErrorMsg('');
    const uploadedDocs: VaultDocument[] = [];

    try {
      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
        setUploadProgressText(`Encrypting & uploading ${i + 1} of ${stagedFiles.length}: "${item.title}"`);
        setUploadProgressPercent(Math.round(((i + 1) / stagedFiles.length) * 100));

        const payload = {
          userId: currentUser?.id || 'usr_default',
          ownerName: currentUser?.name || 'Vault User',
          title: item.title || item.name,
          category: item.category,
          documentNumber: item.documentNumber || '',
          fileName: item.name,
          fileType: item.type,
          fileSize: item.size,
          expiryDate: item.expiryDate || undefined,
          reminderDaysBefore: 30,
          sensitivity: item.sensitivity,
          tags: item.tags,
          notes: item.notes,
          fileContent: item.contentDataUrl,
          verifiedIssuer: item.category === 'VOICE_AUDIO' ? 'Voice & Audio Vault' : 'Self-Uploaded',
          audioDurationSeconds: item.audioDurationSeconds
        };

        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`Failed to upload ${item.name}`);
        }

        const created = await res.json();
        uploadedDocs.push(created);
      }

      if (onBatchUploadSuccess && uploadedDocs.length > 1) {
        onBatchUploadSuccess(uploadedDocs);
      } else if (uploadedDocs.length > 0) {
        uploadedDocs.forEach(d => onUploadSuccess(d));
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during upload.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // --------------------------------------------------------------------------
  // OPTION 2: Take Photo / Video (Device Camera & Recorder)
  // --------------------------------------------------------------------------
  const [cameraMode, setCameraMode] = useState<'PHOTO' | 'VIDEO'>('PHOTO');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string>('');
  const [capturedMedia, setCapturedMedia] = useState<{
    type: 'PHOTO' | 'VIDEO';
    dataUrl: string;
    blob?: Blob;
    size: number;
    duration?: number;
  } | null>(null);

  // Video recording
  const [isVideoRecording, setIsVideoRecording] = useState<boolean>(false);
  const [videoTimerSeconds, setVideoTimerSeconds] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerIntervalRef = useRef<number | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Metadata for captured media
  const [mediaTitle, setMediaTitle] = useState<string>('');
  const [mediaCategory, setMediaCategory] = useState<DocumentCategory>('IDENTITY');
  const [mediaSensitivity, setMediaSensitivity] = useState<SensitivityLevel>('CONFIDENTIAL');

  const startCamera = async () => {
    setCameraError('');
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: cameraMode === 'VIDEO'
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback without audio if audio failed
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        });
      }

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream request failed:', err);
      setCameraError('Unable to access device camera directly. You can use the Native Camera button below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoTimerIntervalRef.current) {
      clearInterval(videoTimerIntervalRef.current);
      videoTimerIntervalRef.current = null;
    }
    setCameraActive(false);
    setIsVideoRecording(false);
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const byteString = atob(dataUrl.split(',')[1]);
    const size = byteString.length;

    stopCamera();
    setCapturedMedia({
      type: 'PHOTO',
      dataUrl,
      size
    });
    setMediaTitle(`Camera Photo - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
    setMediaCategory('IDENTITY');
  };

  const startVideoRecording = () => {
    if (!cameraStreamRef.current) return;
    videoChunksRef.current = [];

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setCapturedMedia({
            type: 'VIDEO',
            dataUrl,
            blob: videoBlob,
            size: videoBlob.size,
            duration: videoTimerSeconds
          });
          setMediaTitle(`Camera Video - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${videoTimerSeconds}s)`);
          setMediaCategory('OTHER');
        };
        reader.readAsDataURL(videoBlob);
      };

      recorder.start(500);
      setIsVideoRecording(true);
      setVideoTimerSeconds(0);

      videoTimerIntervalRef.current = window.setInterval(() => {
        setVideoTimerSeconds(prev => prev + 1);
      }, 1000);
    } catch (e: any) {
      setCameraError('Failed to initialize video recording: ' + e.message);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (videoTimerIntervalRef.current) {
      clearInterval(videoTimerIntervalRef.current);
      videoTimerIntervalRef.current = null;
    }
    setIsVideoRecording(false);
    stopCamera();
  };

  const handleNativeCameraFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedMedia({
        type: isVid ? 'VIDEO' : 'PHOTO',
        dataUrl,
        blob: file,
        size: file.size
      });
      setMediaTitle(`Device ${isVid ? 'Video' : 'Photo'} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      setMediaCategory(isVid ? 'OTHER' : 'IDENTITY');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCapturedMedia = async () => {
    if (!capturedMedia) return;
    setIsEncrypting(true);
    setErrorMsg('');

    try {
      const isVid = capturedMedia.type === 'VIDEO';
      const fileExt = isVid ? 'webm' : 'jpg';
      const mimeType = isVid ? 'video/webm' : 'image/jpeg';
      const safeTitle = mediaTitle.trim() || `Camera Capture - ${Date.now()}`;

      const payload = {
        userId: currentUser?.id || 'usr_default',
        ownerName: currentUser?.name || 'Vault User',
        title: safeTitle,
        category: mediaCategory,
        documentNumber: '',
        fileName: `${safeTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.${fileExt}`,
        fileType: mimeType,
        fileSize: capturedMedia.size,
        sensitivity: mediaSensitivity,
        tags: ['camera', isVid ? 'video' : 'photo', 'biometric-capture'],
        notes: `Captured via device camera on ${new Date().toLocaleString()}`,
        fileContent: capturedMedia.dataUrl,
        verifiedIssuer: 'Camera Media Capture'
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to encrypt and save media.');
      const created = await res.json();
      onUploadSuccess(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving captured media.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // --------------------------------------------------------------------------
  // OPTION 3: Voice Input (Record Live or Select Audio Files)
  // --------------------------------------------------------------------------
  const [voiceSubTab, setVoiceSubTab] = useState<'RECORD' | 'SELECT'>('RECORD');
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [isVoicePaused, setIsVoicePaused] = useState<boolean>(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState<number>(0);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [recordedVoiceBlob, setRecordedVoiceBlob] = useState<Blob | null>(null);
  const [recordedVoiceUrl, setRecordedVoiceUrl] = useState<string | null>(null);
  const [voiceAudioDuration, setVoiceAudioDuration] = useState<number>(0);

  // Audio Playback
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState<boolean>(false);
  const voiceAudioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceAudioChunksRef = useRef<Blob[]>([]);
  const voiceTimerIntervalRef = useRef<number | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Voice Note metadata
  const [voiceTitle, setVoiceTitle] = useState<string>('');
  const [voiceSensitivity, setVoiceSensitivity] = useState<SensitivityLevel>('CONFIDENTIAL');
  const [voiceNotes, setVoiceNotes] = useState<string>('');

  const startVoiceRecording = async () => {
    setErrorMsg('');
    stopVoiceRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setVoiceStream(stream);
      voiceAudioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      voiceMediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          voiceAudioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(voiceAudioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedVoiceBlob(audioBlob);
        setRecordedVoiceUrl(url);
        setVoiceAudioDuration(voiceRecordingSeconds);
      };

      recorder.start(250);
      setIsVoiceRecording(true);
      setIsVoicePaused(false);
      setVoiceRecordingSeconds(0);

      voiceTimerIntervalRef.current = window.setInterval(() => {
        setVoiceRecordingSeconds(prev => prev + 1);
      }, 1000);

      const defaultTitle = `Voice Note - ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      setVoiceTitle(defaultTitle);
    } catch (err: any) {
      setErrorMsg('Microphone access denied or not available. Please allow mic permissions or use "Select Audio File".');
    }
  };

  const pauseVoiceRecording = () => {
    if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state === 'recording') {
      voiceMediaRecorderRef.current.pause();
      setIsVoicePaused(true);
      if (voiceTimerIntervalRef.current) {
        clearInterval(voiceTimerIntervalRef.current);
        voiceTimerIntervalRef.current = null;
      }
    }
  };

  const resumeVoiceRecording = () => {
    if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state === 'paused') {
      voiceMediaRecorderRef.current.resume();
      setIsVoicePaused(false);
      voiceTimerIntervalRef.current = window.setInterval(() => {
        setVoiceRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state !== 'inactive') {
      voiceMediaRecorderRef.current.stop();
    }
    if (voiceStream) {
      voiceStream.getTracks().forEach(t => t.stop());
      setVoiceStream(null);
    }
    if (voiceTimerIntervalRef.current) {
      clearInterval(voiceTimerIntervalRef.current);
      voiceTimerIntervalRef.current = null;
    }
    setIsVoiceRecording(false);
    setIsVoicePaused(false);
  };

  const handleUploadVoiceRecording = async () => {
    if (!recordedVoiceBlob) return;
    setIsEncrypting(true);
    setErrorMsg('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const safeTitle = voiceTitle.trim() || `Voice Note - ${new Date().toLocaleString()}`;

        const payload = {
          userId: currentUser?.id || 'usr_default',
          ownerName: currentUser?.name || 'Vault User',
          title: safeTitle,
          category: 'VOICE_AUDIO',
          documentNumber: '',
          fileName: `${safeTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`,
          fileType: recordedVoiceBlob.type || 'audio/webm',
          fileSize: recordedVoiceBlob.size,
          sensitivity: voiceSensitivity,
          tags: ['voice-clip', 'audio-note', 'encrypted-audio'],
          notes: voiceNotes || 'Live recorded encrypted voice clip.',
          fileContent: dataUrl,
          verifiedIssuer: 'Voice & Audio Vault',
          audioDurationSeconds: voiceAudioDuration || voiceRecordingSeconds
        };

        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to encrypt and save voice note.');
        const created = await res.json();
        onUploadSuccess(created);
        onClose();
      };
      reader.readAsDataURL(recordedVoiceBlob);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving voice note.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // --------------------------------------------------------------------------
  // OPTION 4: Paste (Text, Images, Videos, Files, Clipboard)
  // --------------------------------------------------------------------------
  const [pastedItem, setPastedItem] = useState<{
    type: 'IMAGE' | 'TEXT' | 'VIDEO' | 'FILE';
    content: string; // text string or dataUrl
    fileName: string;
    fileType: string;
    fileSize: number;
    charCount?: number;
    wordCount?: number;
  } | null>(null);

  const [pasteTitle, setPasteTitle] = useState<string>('');
  const [pasteCategory, setPasteCategory] = useState<DocumentCategory>('OTHER');
  const [pasteSensitivity, setPasteSensitivity] = useState<SensitivityLevel>('CONFIDENTIAL');
  const [pasteNotes, setPasteNotes] = useState<string>('');
  const pasteTargetRef = useRef<HTMLDivElement>(null);

  const handleClipboardPasteEvent = (e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = (e as any).clipboardData;
    if (!clipboardData) return;
    setErrorMsg('');

    // 1. Check for files (Images, Videos, Documents)
    if (clipboardData.files && clipboardData.files.length > 0) {
      // If multiple files are pasted, also offer multi-file support!
      if (clipboardData.files.length > 1) {
        processSelectedFiles(clipboardData.files);
        return;
      }

      const file = clipboardData.files[0];
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPastedItem({
          type: isImg ? 'IMAGE' : isVid ? 'VIDEO' : 'FILE',
          content: dataUrl,
          fileName: file.name || (isImg ? 'pasted_screenshot.png' : 'pasted_file.dat'),
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size
        });

        const cat = detectCategory(file.name, file.type);
        setPasteCategory(cat);
        setPasteTitle(
          isImg
            ? `Pasted Screenshot - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : isVid
            ? `Pasted Video - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        );
      };
      reader.readAsDataURL(file);
      return;
    }

    // 2. Check for text / code / URL content
    const textData = clipboardData.getData('text/plain') || clipboardData.getData('text');
    if (textData && textData.trim()) {
      const cleanText = textData.trim();
      const words = cleanText.split(/\s+/).filter(Boolean).length;
      const chars = cleanText.length;
      const firstLine = cleanText.split('\n')[0].substring(0, 40);

      // Create base64 data URL for text
      const base64Text = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(cleanText)))}`;

      setPastedItem({
        type: 'TEXT',
        content: cleanText,
        fileName: 'clipboard_note.txt',
        fileType: 'text/plain',
        fileSize: new Blob([cleanText]).size,
        charCount: chars,
        wordCount: words
      });

      setPasteTitle(firstLine ? `Note: ${firstLine}` : `Pasted Note - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      setPasteCategory('OTHER');
    }
  };

  const handleReadSystemClipboard = async () => {
    setErrorMsg('');
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                setPastedItem({
                  type: 'IMAGE',
                  content: dataUrl,
                  fileName: 'clipboard_screenshot.png',
                  fileType: type,
                  fileSize: blob.size
                });
                setPasteTitle(`Pasted Screenshot - ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
                setPasteCategory('IDENTITY');
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      // Fallback to text read
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const words = text.trim().split(/\s+/).filter(Boolean).length;
          const chars = text.length;
          const firstLine = text.trim().split('\n')[0].substring(0, 40);

          setPastedItem({
            type: 'TEXT',
            content: text,
            fileName: 'clipboard_note.txt',
            fileType: 'text/plain',
            fileSize: new Blob([text]).size,
            charCount: chars,
            wordCount: words
          });
          setPasteTitle(firstLine ? `Note: ${firstLine}` : `Pasted Note - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
          setPasteCategory('OTHER');
          return;
        }
      }

      setErrorMsg('No readable content found on clipboard. Click inside the box and press Ctrl+V / Cmd+V.');
    } catch (e: any) {
      setErrorMsg('Could not access clipboard directly: ' + (e.message || 'Permission denied') + '. Click inside the box and press Ctrl+V.');
    }
  };

  const handleUploadPastedContent = async () => {
    if (!pastedItem) return;
    setIsEncrypting(true);
    setErrorMsg('');

    try {
      let finalContent = pastedItem.content;
      if (pastedItem.type === 'TEXT') {
        finalContent = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(pastedItem.content)))}`;
      }

      const safeTitle = pasteTitle.trim() || `Pasted Record - ${Date.now()}`;

      const payload = {
        userId: currentUser?.id || 'usr_default',
        ownerName: currentUser?.name || 'Vault User',
        title: safeTitle,
        category: pasteCategory,
        documentNumber: '',
        fileName: pastedItem.fileName,
        fileType: pastedItem.fileType,
        fileSize: pastedItem.fileSize,
        sensitivity: pasteSensitivity,
        tags: ['pasted', pastedItem.type.toLowerCase(), 'clipboard'],
        notes: pasteNotes || `Pasted content recorded on ${new Date().toLocaleString()}`,
        fileContent: finalContent,
        verifiedIssuer: 'Pasted Clipboard Record'
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to encrypt and save pasted content.');
      const created = await res.json();
      onUploadSuccess(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving pasted content.');
    } finally {
      setIsEncrypting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            {activeOption !== 'SELECTION' && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  stopVoiceRecording();
                  setActiveOption('SELECTION');
                  setErrorMsg('');
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer mr-1"
                title="Back to Upload Options"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>UPLOAD NEW</span>
                {currentUser?.name && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    Vault: {currentUser.name}
                  </span>
                )}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hidden sm:inline">
                  AES-256-GCM
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeOption === 'SELECTION' && `Choose an upload method to encrypt and store in ${currentUser?.name ? `${currentUser.name}'s` : 'your'} vault`}
                {activeOption === 'DEVICE' && `Upload files or documents for ${currentUser?.name || 'this person'} (multi-file support)`}
                {activeOption === 'CAMERA' && 'Capture live photo or record video using device camera'}
                {activeOption === 'VOICE' && 'Record a live voice clip or choose an existing audio file'}
                {activeOption === 'PASTE' && 'Paste text, screenshots, files, or clipboard data'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              stopVoiceRecording();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Tabs Bar (Quick Switcher) */}
        {activeOption !== 'SELECTION' && (
          <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/20 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                stopVoiceRecording();
                setActiveOption('DEVICE');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                activeOption === 'DEVICE'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Upload from Device</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopVoiceRecording();
                setActiveOption('CAMERA');
                startCamera();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                activeOption === 'CAMERA'
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Photo/Video</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveOption('VOICE');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                activeOption === 'VOICE'
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Input</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                stopVoiceRecording();
                setActiveOption('PASTE');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                activeOption === 'PASTE'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* ================================================================= */}
          {/* VIEW: SELECTION HUB (The 4 Options)                              */}
          {/* ================================================================= */}
          {activeOption === 'SELECTION' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-xs text-slate-300 font-medium">
                  Select how you want to add documents or media to your secure vault:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Upload from Device */}
                <button
                  id="btn-option-device"
                  type="button"
                  onClick={() => {
                    setActiveOption('DEVICE');
                    if (deviceFileInputRef.current) {
                      deviceFileInputRef.current.click();
                    }
                  }}
                  className="group relative flex flex-col items-start p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/40 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm ring-1 ring-transparent hover:ring-blue-500/20"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderUp className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Multi-File
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    Upload from Device
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Upload any file or input type available on your device, including multiple files at once.
                  </p>
                  <div className="mt-3 text-[11px] text-blue-400 font-medium flex items-center gap-1">
                    <span>Browse files</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Take Photo / Video */}
                <button
                  id="btn-option-camera"
                  type="button"
                  onClick={() => {
                    setActiveOption('CAMERA');
                    startCamera();
                  }}
                  className="group relative flex flex-col items-start p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm ring-1 ring-transparent hover:ring-emerald-500/20"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Camera Live
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Take Photo/Video
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Capture a photo or record video directly using your device camera and upload it.
                  </p>
                  <div className="mt-3 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span>Open camera</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Voice Input */}
                <button
                  id="btn-option-voice"
                  type="button"
                  onClick={() => {
                    setActiveOption('VOICE');
                  }}
                  className="group relative flex flex-col items-start p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-violet-500/40 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm ring-1 ring-transparent hover:ring-violet-500/20"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mic className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      Live & Files
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                    Voice Input
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Record a voice clip live or select an existing audio/voice recording from the device.
                  </p>
                  <div className="mt-3 text-[11px] text-violet-400 font-medium flex items-center gap-1">
                    <span>Start recording</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Paste */}
                <button
                  id="btn-option-paste"
                  type="button"
                  onClick={() => {
                    setActiveOption('PASTE');
                  }}
                  className="group relative flex flex-col items-start p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm ring-1 ring-transparent hover:ring-amber-500/20"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Clipboard className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Ctrl + V
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Paste
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Paste any supported content, including text notes, images, videos, files, or clipboard data.
                  </p>
                  <div className="mt-3 text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <span>Paste clipboard</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Quick Drag & Drop Catch-all at bottom */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processSelectedFiles(e.dataTransfer.files);
                  }
                }}
                className={`p-4 rounded-2xl border-2 border-dashed text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <p className="text-xs text-slate-400">
                  Tip: You can also drag and drop any file(s) anywhere in this window to start.
                </p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* OPTION 1: UPLOAD FROM DEVICE                                      */}
          {/* ================================================================= */}
          {activeOption === 'DEVICE' && (
            <div className="space-y-4">
              {/* Hidden multi-file input */}
              <input
                ref={deviceFileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={handleDeviceFilesSelected}
                className="hidden"
              />

              {stagedFiles.length === 0 ? (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processSelectedFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => deviceFileInputRef.current?.click()}
                  className={`p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-800 hover:border-blue-500/40 bg-slate-950/30'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-3">
                    <FolderUp className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Choose Files to Upload</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Drag and drop any files from your device here, or click to browse. Supports all file formats and multiple files simultaneously.
                  </p>
                  <button
                    type="button"
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Select Files from Device
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <FolderUp className="w-4 h-4 text-blue-400" />
                      {stagedFiles.length} file(s) staged for encryption
                    </span>
                    <button
                      type="button"
                      onClick={() => deviceFileInputRef.current?.click()}
                      className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add more files
                    </button>
                  </div>

                  {/* Staged files list */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {stagedFiles.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                              {getFileIcon(item.type, item.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={item.title}
                                onChange={e => updateStagedFile(item.id, { title: e.target.value })}
                                placeholder="Document title"
                                className="w-full bg-transparent text-xs font-semibold text-white border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none truncate"
                              />
                              <div className="text-[10px] text-slate-400 truncate">
                                {item.name} • {formatBytes(item.size)}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStagedFile(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Staged file settings */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/40 text-xs">
                          <div>
                            <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Category</label>
                            <select
                              value={item.category}
                              onChange={e => updateStagedFile(item.id, { category: e.target.value as DocumentCategory })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                              {CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Sensitivity</label>
                            <select
                              value={item.sensitivity}
                              onChange={e => updateStagedFile(item.id, { sensitivity: e.target.value as SensitivityLevel })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                              <option value="PUBLIC">Public</option>
                              <option value="CONFIDENTIAL">Confidential</option>
                              <option value="RESTRICTED">Restricted</option>
                              <option value="TOP_SECRET">Top Secret</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Encryption & Upload Bar */}
                  {isEncrypting && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-blue-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs text-blue-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          {uploadProgressText}
                        </span>
                        <span>{uploadProgressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${uploadProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      disabled={isEncrypting}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      Clear All
                    </button>
                    <button
                      id="btn-confirm-device-upload"
                      type="button"
                      onClick={handleUploadAllStaged}
                      disabled={isEncrypting || stagedFiles.length === 0}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Encrypt & Upload {stagedFiles.length} File(s)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* OPTION 2: TAKE PHOTO / VIDEO                                      */}
          {/* ================================================================= */}
          {activeOption === 'CAMERA' && (
            <div className="space-y-4">
              {/* Native Camera input fallback */}
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={handleNativeCameraFile}
                className="hidden"
              />

              {!capturedMedia ? (
                <div className="space-y-3">
                  {/* Mode Selector & Flip Camera */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setCameraMode('PHOTO');
                          if (cameraActive) startCamera();
                        }}
                        className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          cameraMode === 'PHOTO'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📷 Photo Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraMode('VIDEO');
                          if (cameraActive) startCamera();
                        }}
                        className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          cameraMode === 'VIDEO'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        🎥 Video Mode
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
                          setTimeout(() => startCamera(), 100);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                        title="Flip Camera (Front / Back)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Flip Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                        title="Open device default camera app"
                      >
                        Native App
                      </button>
                    </div>
                  </div>

                  {/* Camera Viewfinder */}
                  <div className="relative aspect-video w-full rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Shutter overlay / Grid */}
                    <div className="absolute inset-0 pointer-events-none border border-white/10 grid grid-cols-3 grid-rows-3 opacity-30" />

                    {/* Recording indicator */}
                    {isVideoRecording && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-600/90 text-white font-mono text-xs font-bold flex items-center gap-1.5 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-white" />
                        <span>REC {String(Math.floor(videoTimerSeconds / 60)).padStart(2, '0')}:{String(videoTimerSeconds % 60).padStart(2, '0')}</span>
                      </div>
                    )}

                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/80 text-center">
                        <Camera className="w-10 h-10 text-slate-500 mb-2" />
                        <p className="text-xs text-slate-300 font-medium">Camera is currently paused or inactive</p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="mt-3 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Enable Live Camera
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Capture Controls Bar */}
                  <div className="flex items-center justify-center gap-4 pt-2">
                    {cameraMode === 'PHOTO' ? (
                      <button
                        id="btn-snap-photo"
                        type="button"
                        onClick={snapPhoto}
                        disabled={!cameraActive}
                        className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 border-4 border-emerald-500 shadow-xl flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Snap Photo"
                      >
                        <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      </button>
                    ) : !isVideoRecording ? (
                      <button
                        id="btn-start-video"
                        type="button"
                        onClick={startVideoRecording}
                        disabled={!cameraActive}
                        className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 border-4 border-rose-500 shadow-xl flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Start Video Recording"
                      >
                        <div className="w-8 h-8 rounded-full bg-rose-600" />
                      </button>
                    ) : (
                      <button
                        id="btn-stop-video"
                        type="button"
                        onClick={stopVideoRecording}
                        className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 border-4 border-rose-600 shadow-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        title="Stop Video Recording"
                      >
                        <div className="w-6 h-6 rounded-md bg-rose-600" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Captured Media Review & Metadata */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      {capturedMedia.type === 'PHOTO' ? <Camera className="w-4 h-4 text-emerald-400" /> : <Video className="w-4 h-4 text-purple-400" />}
                      Review Captured {capturedMedia.type === 'PHOTO' ? 'Photo' : 'Video'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedMedia(null);
                        startCamera();
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retake
                    </button>
                  </div>

                  {/* Preview Player / Image */}
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    {capturedMedia.type === 'PHOTO' ? (
                      <img
                        src={capturedMedia.dataUrl}
                        alt="Captured"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={capturedMedia.dataUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Metadata Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Title</label>
                      <input
                        type="text"
                        value={mediaTitle}
                        onChange={e => setMediaTitle(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Category</label>
                      <select
                        value={mediaCategory}
                        onChange={e => setMediaCategory(e.target.value as DocumentCategory)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Sensitivity</label>
                      <select
                        value={mediaSensitivity}
                        onChange={e => setMediaSensitivity(e.target.value as SensitivityLevel)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="CONFIDENTIAL">Confidential</option>
                        <option value="RESTRICTED">Restricted</option>
                        <option value="TOP_SECRET">Top Secret</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleUploadCapturedMedia}
                        disabled={isEncrypting}
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {isEncrypting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>Encrypt & Upload {capturedMedia.type}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* OPTION 3: VOICE INPUT                                             */}
          {/* ================================================================= */}
          {activeOption === 'VOICE' && (
            <div className="space-y-4">
              {/* Audio file picker hidden */}
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
                multiple
                onChange={handleDeviceFilesSelected}
                className="hidden"
              />

              {/* Sub-tabs: Live Record vs Select File */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceSubTab('RECORD')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      voiceSubTab === 'RECORD'
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎙️ Record Live Voice Clip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceSubTab('SELECT');
                      audioFileInputRef.current?.click();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      voiceSubTab === 'SELECT'
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📁 Select Existing Audio File
                  </button>
                </div>
              </div>

              {/* RECORD LIVE INTERFACE */}
              {!recordedVoiceBlob ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                  {/* Waveform Visualization */}
                  <div className="w-full h-24 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800/80">
                    {isVoiceRecording ? (
                      <AudioWaveformVisualizer
                        isRecording={isVoiceRecording}
                        isPaused={isVoicePaused}
                        audioStream={voiceStream}
                        barColor="#a855f7"
                        height={80}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        Click "Start Recording" to speak and generate an encrypted voice memo
                      </p>
                    )}
                  </div>

                  {/* Timer */}
                  <div className="text-2xl font-mono font-bold text-white tracking-wider">
                    {String(Math.floor(voiceRecordingSeconds / 60)).padStart(2, '0')}:
                    {String(voiceRecordingSeconds % 60).padStart(2, '0')}
                  </div>

                  {/* Recording Controls */}
                  <div className="flex items-center gap-3">
                    {!isVoiceRecording ? (
                      <button
                        id="btn-start-voice-rec"
                        type="button"
                        onClick={startVoiceRecording}
                        className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all active:scale-95 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <>
                        {isVoicePaused ? (
                          <button
                            type="button"
                            onClick={resumeVoiceRecording}
                            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700 cursor-pointer"
                            title="Resume Recording"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={pauseVoiceRecording}
                            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 cursor-pointer"
                            title="Pause Recording"
                          >
                            <Pause className="w-5 h-5" />
                          </button>
                        )}

                        <button
                          id="btn-stop-voice-rec"
                          type="button"
                          onClick={stopVoiceRecording}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Stop & Review</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* REVIEW RECORDED AUDIO */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <FileAudio className="w-4 h-4 text-violet-400" />
                      Recorded Voice Note ({formatAudioDuration(voiceAudioDuration)})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordedVoiceBlob(null);
                        setRecordedVoiceUrl(null);
                        setVoiceRecordingSeconds(0);
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Record Again
                    </button>
                  </div>

                  {/* Audio Player Preview */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
                    <audio
                      ref={voiceAudioPreviewRef}
                      src={recordedVoiceUrl || undefined}
                      controls
                      className="w-full h-10"
                    />
                  </div>

                  {/* Metadata Fields */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Title</label>
                      <input
                        type="text"
                        value={voiceTitle}
                        onChange={e => setVoiceTitle(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Sensitivity</label>
                      <select
                        value={voiceSensitivity}
                        onChange={e => setVoiceSensitivity(e.target.value as SensitivityLevel)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="CONFIDENTIAL">Confidential</option>
                        <option value="RESTRICTED">Restricted</option>
                        <option value="TOP_SECRET">Top Secret</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Notes / Description (Optional)</label>
                      <textarea
                        value={voiceNotes}
                        onChange={e => setVoiceNotes(e.target.value)}
                        rows={2}
                        placeholder="Add summary or transcription notes..."
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleUploadVoiceRecording}
                        disabled={isEncrypting}
                        className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isEncrypting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>Encrypt & Upload Voice Note</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* OPTION 4: PASTE (Clipboard Content)                               */}
          {/* ================================================================= */}
          {activeOption === 'PASTE' && (
            <div className="space-y-4">
              {!pastedItem ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Paste from clipboard: text notes, screenshots, images, videos, or copied files.
                    </span>
                    <button
                      type="button"
                      onClick={handleReadSystemClipboard}
                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      Read Clipboard
                    </button>
                  </div>

                  {/* Interactive Paste Drop Box */}
                  <div
                    ref={pasteTargetRef}
                    tabIndex={0}
                    onPaste={handleClipboardPasteEvent}
                    className="p-10 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 focus:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                      <Clipboard className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Click here & Press Ctrl + V (or ⌘ + V)</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Instantly paste copied screenshots, text notes, codes, links, media, or files from your clipboard.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Screenshots</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Images</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Text Notes</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Copied Files</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Pasted Content Review */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Clipboard className="w-4 h-4 text-amber-400" />
                      Review Pasted {pastedItem.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPastedItem(null)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Paste Different Content
                    </button>
                  </div>

                  {/* Pasted Content Preview Box */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 max-h-56 overflow-y-auto">
                    {pastedItem.type === 'IMAGE' && (
                      <div className="flex items-center justify-center">
                        <img
                          src={pastedItem.content}
                          alt="Pasted screenshot"
                          className="max-h-48 rounded-xl object-contain"
                        />
                      </div>
                    )}

                    {pastedItem.type === 'TEXT' && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-amber-400 font-mono">
                          {pastedItem.wordCount} words • {pastedItem.charCount} characters
                        </div>
                        <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap break-words p-2 rounded-lg bg-slate-900 border border-slate-800">
                          {pastedItem.content}
                        </pre>
                      </div>
                    )}

                    {pastedItem.type === 'VIDEO' && (
                      <video
                        src={pastedItem.content}
                        controls
                        className="max-h-48 rounded-xl mx-auto"
                      />
                    )}

                    {pastedItem.type === 'FILE' && (
                      <div className="flex items-center gap-3 p-3">
                        {getFileIcon(pastedItem.fileType, pastedItem.fileName)}
                        <div>
                          <div className="text-xs font-bold text-white">{pastedItem.fileName}</div>
                          <div className="text-[10px] text-slate-400">{formatBytes(pastedItem.fileSize)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Title</label>
                      <input
                        type="text"
                        value={pasteTitle}
                        onChange={e => setPasteTitle(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Category</label>
                      <select
                        value={pasteCategory}
                        onChange={e => setPasteCategory(e.target.value as DocumentCategory)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Sensitivity</label>
                      <select
                        value={pasteSensitivity}
                        onChange={e => setPasteSensitivity(e.target.value as SensitivityLevel)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="CONFIDENTIAL">Confidential</option>
                        <option value="RESTRICTED">Restricted</option>
                        <option value="TOP_SECRET">Top Secret</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleUploadPastedContent}
                        disabled={isEncrypting}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {isEncrypting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>Encrypt & Upload Pasted Content</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
