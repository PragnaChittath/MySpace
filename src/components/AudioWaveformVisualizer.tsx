import React, { useEffect, useRef } from 'react';

interface AudioWaveformVisualizerProps {
  isRecording?: boolean;
  isPaused?: boolean;
  isPlaying?: boolean;
  audioStream?: MediaStream | null;
  audioElement?: HTMLAudioElement | null;
  barColor?: string;
  height?: number;
}

export function AudioWaveformVisualizer({
  isRecording = false,
  isPaused = false,
  isPlaying = false,
  audioStream = null,
  audioElement = null,
  barColor = '#14b8a6', // teal-500
  height = 64
}: AudioWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localAudioCtx: AudioContext | null = null;
    let localAnalyser: AnalyserNode | null = null;

    if (isRecording && audioStream && !isPaused) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        localAudioCtx = new AudioCtx();
        audioContextRef.current = localAudioCtx;

        localAnalyser = localAudioCtx.createAnalyser();
        localAnalyser.fftSize = 64;
        localAnalyser.smoothingTimeConstant = 0.8;
        analyserRef.current = localAnalyser;

        const source = localAudioCtx.createMediaStreamSource(audioStream);
        source.connect(localAnalyser);
        sourceRef.current = source;
      } catch (e) {
        console.warn('Web Audio API not initialized for mic:', e);
      }
    }

    const draw = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      if (isRecording && !isPaused && localAnalyser) {
        const bufferLength = localAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        localAnalyser.getByteFrequencyData(dataArray);

        const barCount = 32;
        const barWidth = (width / barCount) - 3;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const index = Math.floor((i / barCount) * bufferLength);
          const value = dataArray[index] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * h * 0.9);

          // Gradient color
          const gradient = ctx.createLinearGradient(0, h - barHeight, 0, h);
          gradient.addColorStop(0, '#2dd4bf'); // teal-400
          gradient.addColorStop(1, '#0d9488'); // teal-600

          ctx.fillStyle = gradient;
          ctx.beginPath();
          // Draw rounded vertical bar centered vertically
          const y = (h - barHeight) / 2;
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();

          x += barWidth + 3;
        }
      } else if (isPlaying && !isPaused) {
        // Simulated rhythm wave during playback
        const barCount = 32;
        const barWidth = (width / barCount) - 3;
        const now = Date.now() / 150;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(now + i * 0.4) * 0.5 + 0.5;
          const wave2 = Math.cos(now * 0.8 + i * 0.2) * 0.3 + 0.3;
          const combined = (wave + wave2) / 1.6;
          const barHeight = Math.max(6, combined * h * 0.85);

          const gradient = ctx.createLinearGradient(0, (h - barHeight) / 2, 0, (h + barHeight) / 2);
          gradient.addColorStop(0, '#a855f7'); // purple-500
          gradient.addColorStop(1, '#14b8a6'); // teal-500

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, (h - barHeight) / 2, barWidth, barHeight, 2);
          ctx.fill();

          x += barWidth + 3;
        }
      } else {
        // Idle flat bars
        const barCount = 32;
        const barWidth = (width / barCount) - 3;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const barHeight = 4;
          ctx.fillStyle = isPaused ? '#f59e0b44' : '#334155';
          ctx.beginPath();
          ctx.roundRect(x, (h - barHeight) / 2, barWidth, barHeight, 2);
          ctx.fill();
          x += barWidth + 3;
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (localAudioCtx && localAudioCtx.state !== 'closed') {
        localAudioCtx.close().catch(() => {});
      }
    };
  }, [isRecording, isPaused, isPlaying, audioStream]);

  return (
    <div className="w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={380}
        height={height}
        className="w-full h-full max-h-[80px]"
      />
    </div>
  );
}
