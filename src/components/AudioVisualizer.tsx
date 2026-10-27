'use client';

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  stream,
  isActive,
  color = '#10b981',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !isActive || !stream) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!ctx || !canvas || !analyser) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barCount = 18;
        const barWidth = 4;
        const totalWidth = barCount * (barWidth + 4);
        let startX = (canvas.width - totalWidth) / 2;

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i % bufferLength] || 10;
          const barHeight = Math.max(4, (value / 255) * (canvas.height - 8));
          const y = (canvas.height - barHeight) / 2;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(startX, y, barWidth, barHeight, 2);
          ctx.fill();

          startX += barWidth + 4;
        }
      };

      draw();
    } catch (e) {
      console.warn('AudioVisualizer setup error:', e);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      try {
        source?.disconnect();
        analyser?.disconnect();
        audioCtx?.close();
      } catch (e) {}
    };
  }, [stream, isActive, color]);

  return (
    <div className="flex items-center justify-center h-16 w-full">
      <canvas
        ref={canvasRef}
        width={240}
        height={60}
        className="w-full max-w-[240px] h-[60px]"
      />
    </div>
  );
};
