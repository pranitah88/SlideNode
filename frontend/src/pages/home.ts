import { MeetingRecorderService, RecordingState } from '../services/recorder';
import { initNavbarControls } from '../services/navbar';
import { auth } from '../services/auth';
import { processAndDownloadAudio } from '../services/audioConverter';

const API_BASE_URL = import.meta.env ? (import.meta.env.VITE_API_URL || 'http://localhost:3000') : 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce authentication guard
  const user = await auth.initAuthGuard(true);
  if (!user) return;

  await initNavbarControls();

  const recorder = new MeetingRecorderService();

  // Elements
  const btnRecordMeeting = document.getElementById('recordMeetingBtn') as HTMLButtonElement;
  const btnUploadMeeting = document.getElementById('uploadMeetingBtn') as HTMLButtonElement;
  const audioFileInput = document.getElementById('audioFileInput') as HTMLInputElement;
  const uploadResultContainer = document.getElementById('uploadResultContainer') as HTMLElement;

  // Recording Modal Elements
  const modal = document.getElementById('recordMeetingModal') as HTMLElement;
  const btnCloseModal = document.getElementById('btnCloseRecordModal') as HTMLButtonElement;
  const recordingStatusPill = document.getElementById('recordingStatusPill') as HTMLElement;
  const recordingTimer = document.getElementById('recordingTimer') as HTMLElement;
  const recordingCanvas = document.getElementById('recordingWaveform') as HTMLCanvasElement;
  const audioPreview = document.getElementById('recordedAudioPreview') as HTMLAudioElement;
  const recordErrorBox = document.getElementById('recordErrorBox') as HTMLElement;
  const recordErrorMessage = document.getElementById('recordErrorMessage') as HTMLElement;

  // Containers
  const readyStateButtons = document.getElementById('readyStateButtons') as HTMLElement;
  const recordingActiveButtons = document.getElementById('recordingActiveButtons') as HTMLElement;
  const stoppedStateButtons = document.getElementById('stoppedStateButtons') as HTMLElement;

  // Modal Action Buttons
  const btnStartRecord = document.getElementById('btnStartRecord') as HTMLButtonElement;
  const btnPauseRecord = document.getElementById('btnPauseRecord') as HTMLButtonElement;
  const btnPauseIcon = document.getElementById('btnPauseIcon') as HTMLElement;
  const btnPauseText = document.getElementById('btnPauseText') as HTMLElement;
  const btnStopRecord = document.getElementById('btnStopRecord') as HTMLButtonElement;
  const btnPlayRecord = document.getElementById('btnPlayRecord') as HTMLButtonElement;
  const btnPlayIcon = document.getElementById('btnPlayIcon') as HTMLElement;
  const btnPlayText = document.getElementById('btnPlayText') as HTMLElement;
  const btnRecordAgain = document.getElementById('btnRecordAgain') as HTMLButtonElement;
  const btnDownloadAudio = document.getElementById('btnDownloadAudio') as HTMLButtonElement;
  const btnUploadAudio = document.getElementById('btnUploadAudio') as HTMLButtonElement;
  const btnCancelRecord = document.getElementById('btnCancelRecord') as HTMLButtonElement;

  // Progress UI Elements
  const progressContainer = document.getElementById('recordProcessingProgress') as HTMLElement;
  const progressStageText = document.getElementById('progressStageText') as HTMLElement;
  const progressBarFill = document.getElementById('progressBarFill') as HTMLElement;

  // Open Recording Modal
  if (btnRecordMeeting && modal) {
    btnRecordMeeting.addEventListener('click', () => {
      recorder.reset();
      resetModalUI();
      modal.classList.remove('hidden');
    });
  }

  // Close Modal
  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener('click', () => {
      recorder.reset();
      modal.classList.add('hidden');
    });
  }

  if (btnCancelRecord && modal) {
    btnCancelRecord.addEventListener('click', () => {
      recorder.reset();
      modal.classList.add('hidden');
    });
  }

  // Handle Recording State Changes
  recorder.onStateChange((state: RecordingState) => {
    // Update Timer
    if (recordingTimer) {
      recordingTimer.textContent = state.durationFormatted;
    }

    // Handle Error State
    if (state.status === 'error' && state.errorMessage) {
      if (recordErrorBox && recordErrorMessage) {
        recordErrorMessage.textContent = state.errorMessage;
        recordErrorBox.classList.remove('hidden');
      }
      showControlButtons('idle');
      return;
    } else if (recordErrorBox) {
      recordErrorBox.classList.add('hidden');
    }

    // Update Status Pill & Buttons based on status
    if (state.status === 'recording') {
      if (recordingStatusPill) {
        recordingStatusPill.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span> <span class="text-error font-bold">🔴 Recording Meeting</span>`;
      }
      if (btnPauseIcon) btnPauseIcon.textContent = '⏸';
      if (btnPauseText) btnPauseText.textContent = 'Pause';
      showControlButtons('recording');
    } else if (state.status === 'paused') {
      if (recordingStatusPill) {
        recordingStatusPill.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> <span class="text-amber-600 font-bold">⏸ Recording Paused</span>`;
      }
      if (btnPauseIcon) btnPauseIcon.textContent = '▶';
      if (btnPauseText) btnPauseText.textContent = 'Resume';
      showControlButtons('recording');
    } else if (state.status === 'stopped') {
      if (recordingStatusPill) {
        recordingStatusPill.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-success"></span> <span class="text-success font-semibold">✓ Recording Complete · ${state.durationFormatted} · ${state.sizeFormatted}</span>`;
      }
      if (audioPreview && state.audioUrl) {
        audioPreview.src = state.audioUrl;
        audioPreview.classList.remove('hidden');
      }
      showControlButtons('stopped');
    } else if (state.status === 'idle') {
      if (recordingStatusPill) {
        recordingStatusPill.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-primary/60"></span> <span class="text-on-surface-variant font-medium">Ready to record</span>`;
      }
      showControlButtons('idle');
    }
  });

  // Start Recording Click
  if (btnStartRecord) {
    btnStartRecord.addEventListener('click', async () => {
      if (recordErrorBox) recordErrorBox.classList.add('hidden');
      btnStartRecord.disabled = true;
      btnStartRecord.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Requesting Microphone...';

      const success = await recorder.startRecording(recordingCanvas);
      if (!success) {
        btnStartRecord.disabled = false;
        btnStartRecord.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Start Recording';
      }
    });
  }

  // Pause / Resume Recording Click
  if (btnPauseRecord) {
    btnPauseRecord.addEventListener('click', () => {
      if (recorder.state.status === 'recording') {
        recorder.pauseRecording();
      } else if (recorder.state.status === 'paused') {
        recorder.resumeRecording();
      }
    });
  }

  // Stop Recording Click
  if (btnStopRecord) {
    btnStopRecord.addEventListener('click', () => {
      recorder.stopRecording();
    });
  }

  // Play Recording Click (Toggle Play/Pause)
  if (btnPlayRecord && audioPreview) {
    btnPlayRecord.addEventListener('click', () => {
      if (audioPreview.paused) {
        audioPreview.play();
        if (btnPlayIcon) btnPlayIcon.textContent = '⏸';
        if (btnPlayText) btnPlayText.textContent = 'Pause Recording';
      } else {
        audioPreview.pause();
        if (btnPlayIcon) btnPlayIcon.textContent = '▶';
        if (btnPlayText) btnPlayText.textContent = 'Play Recording';
      }
    });

    audioPreview.addEventListener('ended', () => {
      if (btnPlayIcon) btnPlayIcon.textContent = '▶';
      if (btnPlayText) btnPlayText.textContent = 'Play Recording';
    });
  }

  // Record Again Click (Discard recording & return to ready state)
  if (btnRecordAgain) {
    btnRecordAgain.addEventListener('click', () => {
      recorder.reset();
      resetModalUI();
    });
  }

  // Download Audio Click (Converts browser MediaRecorder WebM/OGG stream into a REAL PCM WAV or MP3 audio file)
  if (btnDownloadAudio) {
    btnDownloadAudio.addEventListener('click', async () => {
      if (!recorder.state.blob) return;

      const formatInput = document.querySelector<HTMLInputElement>('input[name="downloadFormat"]:checked');
      const selectedFormat = (formatInput?.value === 'wav' ? 'wav' : 'mp3') as 'wav' | 'mp3';

      const origText = btnDownloadAudio.innerHTML;
      btnDownloadAudio.disabled = true;
      btnDownloadAudio.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Preparing ${selectedFormat.toUpperCase()}...`;

      try {
        const dateStr = new Date().toISOString().slice(0, 10);
        await processAndDownloadAudio(recorder.state.blob, selectedFormat, `meeting-recording-${dateStr}`);
        btnDownloadAudio.innerHTML = `<span class="text-emerald-600 font-bold">✓</span> Audio Ready (${selectedFormat.toUpperCase()})`;
        setTimeout(() => {
          btnDownloadAudio.innerHTML = origText;
          btnDownloadAudio.disabled = false;
        }, 2500);
      } catch (err: any) {
        console.error('Audio conversion error:', err);
        btnDownloadAudio.innerHTML = origText;
        btnDownloadAudio.disabled = false;
      }
    });
  }

  // Generate Presentation Click (Upload Audio & Open Payment Gate)
  if (btnUploadAudio) {
    btnUploadAudio.addEventListener('click', async () => {
      if (!recorder.state.blob) return;

      try {
        setProcessingState(true);
        updateProgress(10, 'Saving recording...');

        // Step 1: Prepare recorded audio file and fetch authenticated headers
        const formData = new FormData();
        const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const recordedFile = new File([recorder.state.blob], `Recorded_Meeting_${dateStr}.webm`, {
          type: recorder.state.blob.type || 'audio/webm',
        });

        formData.append('audio', recordedFile);
        formData.append('source', 'recorded');
        if (recorder.state.durationSeconds && recorder.state.durationSeconds > 0) {
          formData.append('duration_seconds', String(recorder.state.durationSeconds));
          formData.append('duration', String(recorder.state.durationSeconds));
        }

        const authHeaders = await auth.getAuthHeaders();
        const uploadRes = await fetch(`${API_BASE_URL}/api/meetings/upload`, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Unable to upload the recording. Please try again.');
        }

        const uploadData = await uploadRes.json();
        const meetingId = uploadData.meeting?.id;

        if (!meetingId) {
          throw new Error('Unable to upload the recording. Please try again.');
        }

        // Navigate directly to processing pipeline
        window.location.href = `processing.html?meetingId=${meetingId}`;

      } catch (err: any) {
        console.error('Recording processing error:', err);
        setProcessingState(false);
        if (recordErrorBox && recordErrorMessage) {
          recordErrorMessage.textContent = err.message || 'Unable to upload the recording. Please try again.';
          recordErrorBox.classList.remove('hidden');
        }
      }
    });
  }

  // File Helper Functions
  const ALLOWED_CLIENT_EXTS = new Set(['mp3', 'mpeg', 'mpg', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'mp4', 'flac', 'opus', 'wma']);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDurationDisplay = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds <= 0 || seconds === Infinity) return 'Calculating...';
    const totalSec = Math.round(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getAudioDurationClient = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      let resolved = false;
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio();

      const finish = (sec: number) => {
        if (resolved) return;
        resolved = true;
        try { URL.revokeObjectURL(objectUrl); } catch {}
        resolve(sec && !isNaN(sec) && sec > 0 && isFinite(sec) ? Math.round(sec) : 0);
      };

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0 && isFinite(audio.duration)) {
          finish(audio.duration);
        }
      };

      audio.onerror = () => {
        // Fallback: Web Audio API AudioContext decode
        const reader = new FileReader();
        reader.onload = (evt) => {
          const arrayBuffer = evt.target?.result as ArrayBuffer;
          if (!arrayBuffer) { finish(0); return; }
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) { finish(0); return; }
          const ctx = new AudioCtx();
          ctx.decodeAudioData(
            arrayBuffer,
            (decoded) => {
              ctx.close();
              finish(decoded?.duration || 0);
            },
            () => {
              ctx.close();
              finish(0);
            }
          );
        };
        reader.onerror = () => finish(0);
        reader.readAsArrayBuffer(file);
      };

      audio.src = objectUrl;

      // Safe timeout for large audio files (30s)
      setTimeout(() => {
        finish(audio.duration || 0);
      }, 30000);
    });
  };

  // Upload Meeting File Selection Handler
  if (btnUploadMeeting && audioFileInput) {
    btnUploadMeeting.addEventListener('click', (e) => {
      e.preventDefault();
      audioFileInput.click();
    });

    audioFileInput.addEventListener('change', handleFileSelect);
  }

  // File Select Handler for Upload Meeting button
  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';

    console.log("[AUDIO FILE DEBUG]", {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: ext
    });

    const isExtAllowed = ext && ALLOWED_CLIENT_EXTS.has(ext);
    const isMimeAllowed = file.type && (file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type === 'application/octet-stream' || file.type === '');

    if (!isExtAllowed && !isMimeAllowed) {
      if (uploadResultContainer) {
        uploadResultContainer.innerHTML = `
          <div class="bg-red-50 text-red-900 rounded-2xl border border-red-200 p-6 shadow-md space-y-3 fade-in">
            <div class="flex items-center gap-3">
              <span class="text-xl">⚠️</span>
              <div>
                <h4 class="font-bold text-red-950 text-sm">Unsupported Audio Format</h4>
                <p class="text-xs text-red-800 mt-0.5">Please select an MP3, WAV, M4A, AAC, WEBM, OGG, or MP4 file.</p>
              </div>
            </div>
          </div>`;
        uploadResultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      if (uploadResultContainer) {
        uploadResultContainer.innerHTML = `
          <div class="bg-red-50 text-red-900 rounded-2xl border border-red-200 p-6 shadow-md space-y-3 fade-in">
            <div class="flex items-center gap-3">
              <span class="text-xl">⚠️</span>
              <div>
                <h4 class="font-bold text-red-950 text-sm">File Size Exceeds Limit</h4>
                <p class="text-xs text-red-800 mt-0.5">Audio file is too large. Maximum supported size is 100 MB.</p>
              </div>
            </div>
          </div>`;
        uploadResultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Estimate Duration Client-Side
    const estimatedDuration = await getAudioDurationClient(file);
    const durationStr = formatDurationDisplay(estimatedDuration);

    // State 1: Uploading State with Full Metadata Card
    if (uploadResultContainer) {
      uploadResultContainer.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl border border-primary/30 p-6 md:p-8 shadow-xl space-y-5 fade-in">
          <div class="flex items-center justify-between border-b border-outline-variant/30 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                ☁
              </div>
              <div>
                <h4 class="font-bold text-on-surface text-base truncate max-w-xs md:max-w-md" title="${file.name}">${file.name}</h4>
                <p class="text-xs text-on-surface-variant">${formatFileSize(file.size)} • ${ext.toUpperCase() || 'AUDIO'}</p>
              </div>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary animate-pulse flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span> Uploading...
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
            <div>
              <span class="text-on-surface-variant block mb-0.5">File Name</span>
              <span class="font-semibold text-on-surface truncate block" title="${file.name}">${file.name}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block mb-0.5">File Size</span>
              <span class="font-semibold text-on-surface">${formatFileSize(file.size)}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block mb-0.5">Format</span>
              <span class="font-semibold text-on-surface uppercase">${ext || 'AUDIO'}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block mb-0.5">Est. Duration</span>
              <span class="font-semibold text-on-surface">${durationStr}</span>
            </div>
          </div>

          <div class="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
            <div class="bg-primary h-full transition-all duration-300 w-2/3 animate-pulse"></div>
          </div>
        </div>`;
      uploadResultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('source', 'uploaded');
      if (estimatedDuration > 0) {
        formData.append('duration_seconds', String(estimatedDuration));
        formData.append('duration', String(estimatedDuration));
      }

      const authHeaders = await auth.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/meetings/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (HTTP ${res.status}).`);
      }

      const data = await res.json();
      const meeting = data.meeting;
      const meetingId = meeting?.id || data.fileId;

      if (data.success && meetingId) {
        const finalDurationSeconds = meeting?.audio_duration_seconds || data.duration || estimatedDuration;
        const finalDurationStr = formatDurationDisplay(finalDurationSeconds);

        // State 2: Upload Successful with Active Continue Button
        if (uploadResultContainer) {
          uploadResultContainer.innerHTML = `
            <div class="bg-surface-container-lowest rounded-2xl border border-emerald-500/40 p-6 md:p-8 shadow-xl space-y-5 fade-in">
              <div class="flex items-center justify-between border-b border-outline-variant/30 pb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                    ✓
                  </div>
                  <div>
                    <h4 class="font-bold text-on-surface text-base truncate max-w-xs md:max-w-md" title="${file.name}">${file.name}</h4>
                    <p class="text-xs text-on-surface-variant">${formatFileSize(file.size)} • ${ext.toUpperCase() || 'AUDIO'}</p>
                  </div>
                </div>
                <span class="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-600"></span> Uploaded successfully
                </span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                <div>
                  <span class="text-on-surface-variant block mb-0.5">File Name</span>
                  <span class="font-semibold text-on-surface truncate block" title="${file.name}">${file.name}</span>
                </div>
                <div>
                  <span class="text-on-surface-variant block mb-0.5">File Size</span>
                  <span class="font-semibold text-on-surface">${formatFileSize(file.size)}</span>
                </div>
                <div>
                  <span class="text-on-surface-variant block mb-0.5">Format</span>
                  <span class="font-semibold text-on-surface uppercase">${ext || 'AUDIO'}</span>
                </div>
                <div>
                  <span class="text-on-surface-variant block mb-0.5">Audio Duration</span>
                  <span class="font-semibold text-on-surface">${finalDurationStr}</span>
                </div>
              </div>

              <div class="pt-2 flex justify-end gap-3">
                <a href="processing.html?meetingId=${meetingId}" class="w-full sm:w-auto bg-primary hover:bg-primary/90 text-on-primary font-semibold px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 no-underline cursor-pointer">
                  Generate Presentation →
                </a>
              </div>
            </div>`;
        }
      } else {
        throw new Error(data.error || 'Server responded without meeting record.');
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      if (uploadResultContainer) {
        uploadResultContainer.innerHTML = `
          <div class="bg-red-50 text-red-900 rounded-2xl border border-red-200 p-6 shadow-md space-y-4 fade-in">
            <div class="flex items-center gap-3">
              <span class="text-xl">⚠️</span>
              <div>
                <h4 class="font-bold text-red-950 text-sm">Upload Failed</h4>
                <p class="text-xs text-red-800 mt-0.5">${err.message || 'Unable to upload file. Please try again.'}</p>
              </div>
            </div>
          </div>`;
      }
    }
  }

  // UI Helpers for Recording Modal
  function resetModalUI() {
    if (audioPreview) {
      audioPreview.pause();
      audioPreview.classList.add('hidden');
      audioPreview.src = '';
    }
    if (btnPlayIcon) btnPlayIcon.textContent = '▶';
    if (btnPlayText) btnPlayText.textContent = 'Play Recording';

    if (recordErrorBox) recordErrorBox.classList.add('hidden');
    if (progressContainer) progressContainer.classList.add('hidden');

    if (recordingTimer) recordingTimer.textContent = '00:00:00';
    if (recordingStatusPill) {
      recordingStatusPill.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-primary/60"></span> <span class="text-on-surface-variant font-medium">Ready to record</span>`;
    }

    showControlButtons('idle');
  }

  function showControlButtons(state: 'idle' | 'recording' | 'stopped') {
    if (readyStateButtons) readyStateButtons.classList.toggle('hidden', state !== 'idle');
    if (recordingActiveButtons) recordingActiveButtons.classList.toggle('hidden', state !== 'recording');
    if (stoppedStateButtons) stoppedStateButtons.classList.toggle('hidden', state !== 'stopped');

    if (btnStartRecord && state === 'idle') {
      btnStartRecord.disabled = false;
      btnStartRecord.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Start Recording';
    }

    if (btnUploadAudio && state === 'stopped') {
      btnUploadAudio.disabled = false;
      btnUploadAudio.innerHTML = '<span class="text-base font-bold">↑</span> Upload Audio';
    }
  }

  function setProcessingState(isProcessing: boolean) {
    if (progressContainer) {
      progressContainer.classList.toggle('hidden', !isProcessing);
    }
    if (btnUploadAudio) {
      btnUploadAudio.disabled = isProcessing;
      if (isProcessing) {
        btnUploadAudio.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Uploading...';
      } else {
        btnUploadAudio.innerHTML = '<span class="text-base font-bold">↑</span> Upload Audio';
      }
    }
    if (btnRecordAgain) btnRecordAgain.disabled = isProcessing;
    if (btnPlayRecord) btnPlayRecord.disabled = isProcessing;
    if (btnDownloadAudio) btnDownloadAudio.disabled = isProcessing;
  }

  function updateProgress(percent: number, message: string) {
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    if (progressStageText) progressStageText.textContent = message;
  }

  // Load Recent Meetings List
  async function loadRecentMeetings() {
    const recentGrid = document.getElementById('recent-meetings-grid');
    const recentSection = document.getElementById('recent-meetings-section');
    if (!recentGrid || !recentSection) return;

    try {
      const authHeaders = await auth.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/meetings/recent/list`, {
        headers: authHeaders,
      });

      if (!res.ok) return;

      const data = await res.json();
      const meetingsList = data.meetings || [];

      if (meetingsList.length === 0) {
        recentSection.classList.add('hidden');
        return;
      }

      recentSection.classList.remove('hidden');
      recentGrid.innerHTML = '';

      meetingsList.forEach((m: any) => {
        const isRecorded = m.source === 'recorded' || (m.meeting_name || '').toLowerCase().includes('record');
        const card = document.createElement('div');
        card.className = 'p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary transition-all shadow-sm flex flex-col justify-between space-y-4 group';

        const statusBadge = m.status === 'completed'
          ? `<span class="text-xs text-success font-semibold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-success"></span> Completed</span>`
          : `<span class="text-xs text-primary font-semibold flex items-center gap-1 animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span> Processing...</span>`;

        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-full ${isRecorded ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-primary'} flex items-center justify-center font-bold text-sm">
                ${isRecorded ? '🎙' : '☁'}
              </span>
              <span class="text-xs font-semibold ${isRecorded ? 'text-on-error-container bg-error-container/60' : 'text-primary bg-primary-fixed/60'} px-2.5 py-1 rounded-full capitalize">
                ${isRecorded ? 'Recorded' : 'Uploaded'}
              </span>
            </div>
            <span class="text-xs text-on-surface-variant font-mono bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/40">${m.duration_minutes || 1} min</span>
          </div>

          <div>
            <h4 class="font-display font-bold text-on-surface text-base truncate group-hover:text-primary transition-colors" title="${m.meeting_name}">${m.meeting_name}</h4>
            <p class="text-xs text-on-surface-variant mt-1">${new Date(m.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div class="pt-3 border-t border-outline-variant/40 flex justify-between items-center">
            ${statusBadge}
            <a href="dashboard.html?meetingId=${m.id}" class="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm">
              View Presentation <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>
            </a>
          </div>
        `;

        recentGrid.appendChild(card);
      });

    } catch (err) {
      console.error('Failed to load recent meetings:', err);
    }
  }

  // Load Recent Meetings on Page Load
  await loadRecentMeetings();
});
