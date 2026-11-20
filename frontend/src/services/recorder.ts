export interface RecordingState {
  status: 'idle' | 'recording' | 'paused' | 'stopped' | 'error';
  durationSeconds: number;
  durationFormatted: string;
  blob: Blob | null;
  audioUrl: string | null;
  sizeFormatted: string;
  errorMessage: string | null;
}

export type StateChangeCallback = (state: RecordingState) => void;

export class MeetingRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: any = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  public state: RecordingState = {
    status: 'idle',
    durationSeconds: 0,
    durationFormatted: '00:00:00',
    blob: null,
    audioUrl: null,
    sizeFormatted: '0 B',
    errorMessage: null,
  };

  private callbacks: StateChangeCallback[] = [];

  constructor() {}

  public onStateChange(cb: StateChangeCallback) {
    this.callbacks.push(cb);
  }

  private notifyStateChange() {
    this.callbacks.forEach((cb) => cb({ ...this.state }));
  }

  public isSupported(): boolean {
    return Boolean(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined'
    );
  }

  public async startRecording(canvasElement?: HTMLCanvasElement | null): Promise<boolean> {
    if (!this.isSupported()) {
      this.state.status = 'error';
      this.state.errorMessage = 'Your browser does not support audio recording. Please use Chrome, Edge, Safari, or Firefox.';
      this.notifyStateChange();
      return false;
    }

    try {
      this.reset();
      this.canvasElement = canvasElement || null;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Supported MIME types check
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(this.audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(recordedBlob);

        this.state.status = 'stopped';
        this.state.blob = recordedBlob;
        this.state.audioUrl = audioUrl;
        this.state.sizeFormatted = this.formatBytes(recordedBlob.size);
        this.notifyStateChange();

        this.cleanupStream();
      };

      this.mediaRecorder.start(500); // Collect data every 500ms
      this.state.status = 'recording';
      this.state.durationSeconds = 0;
      this.state.durationFormatted = '00:00:00';
      this.state.errorMessage = null;
      this.notifyStateChange();

      // Start duration timer (1s increment)
      this.startTimer();

      // Waveform visualization
      if (this.canvasElement) {
        this.startWaveformVisualizer(this.stream, this.canvasElement);
      }

      return true;

    } catch (err: any) {
      console.error('Microphone error:', err);
      this.state.status = 'error';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.state.errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings to record.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.state.errorMessage = 'No microphone device found. Please connect a microphone and try again.';
      } else {
        this.state.errorMessage = err.message || 'Unable to access microphone. Please try again.';
      }
      this.notifyStateChange();
      return false;
    }
  }

  public pauseRecording() {
    if (this.mediaRecorder && (this.mediaRecorder.state === 'recording' || this.state.status === 'recording')) {
      try {
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.pause();
        }
      } catch (e) {
        console.warn('MediaRecorder pause warning:', e);
      }

      this.stopTimer();

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.state.status = 'paused';
      this.notifyStateChange();
    }
  }

  public resumeRecording() {
    if (this.mediaRecorder && (this.mediaRecorder.state === 'paused' || this.state.status === 'paused')) {
      try {
        if (this.mediaRecorder.state === 'paused') {
          this.mediaRecorder.resume();
        }
      } catch (e) {
        console.warn('MediaRecorder resume warning:', e);
      }

      this.state.status = 'recording';
      this.startTimer();

      if (this.stream && this.canvasElement) {
        this.startWaveformVisualizer(this.stream, this.canvasElement);
      }

      this.notifyStateChange();
    }
  }

  public stopRecording() {
    this.stopTimer();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  public reset() {
    this.stopRecording();
    this.cleanupStream();
    if (this.state.audioUrl) {
      URL.revokeObjectURL(this.state.audioUrl);
    }
    this.state = {
      status: 'idle',
      durationSeconds: 0,
      durationFormatted: '00:00:00',
      blob: null,
      audioUrl: null,
      sizeFormatted: '0 B',
      errorMessage: null,
    };
    this.notifyStateChange();
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.state.durationSeconds += 1;
      this.state.durationFormatted = this.formatDuration(this.state.durationSeconds);
      this.notifyStateChange();
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private startWaveformVisualizer(stream: MediaStream, canvas: HTMLCanvasElement) {
    try {
      if (this.audioContext && this.audioContext.state === 'closed') {
        this.audioContext = null;
      }

      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 64;
        source.connect(this.analyserNode);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx || !this.analyserNode) return;

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (this.state.status !== 'recording' || !this.analyserNode) return;
        this.animationFrameId = requestAnimationFrame(draw);

        this.analyserNode.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
          ctx.fillStyle = '#004ac6'; // Primary brand blue
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 3, Math.max(barHeight, 4), 4);
          } else {
            ctx.rect(x, (canvas.height - barHeight) / 2, barWidth - 3, Math.max(barHeight, 4));
          }
          ctx.fill();
          x += barWidth + 2;
        }
      };

      draw();
    } catch (e) {
      console.warn('Waveform visualizer warning:', e);
    }
  }

  private formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
