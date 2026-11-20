import { api } from '../services/api';
import { auth } from '../services/auth';
import { initNavbarControls } from '../services/navbar';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

// Toast Notification Helper
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-error text-white' : 'bg-primary text-white';
  toast.className = `${bgColor} px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 transition-all transform translate-y-2 opacity-0 pointer-events-auto shadow-lg`;
  toast.innerHTML = `<span class="material-symbols-outlined text-base">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span> ${message}`;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function getContentSnippet(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content.replace(/\n/g, ' ');
  if (Array.isArray(content)) {
    return content.map((c: any) => typeof c === 'string' ? c : JSON.stringify(c)).join(' ').replace(/\n/g, ' ');
  }
  if (typeof content === 'object') {
    return JSON.stringify(content).replace(/["{}]/g, ' ');
  }
  return '';
}

// Inlines external image URLs in SVG as Base64 Data URLs to avoid canvas taint & CORS blocks
const base64ImageCache = new Map<string, string>();

async function fetchImageAsBase64(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  if (base64ImageCache.has(url)) return base64ImageCache.get(url)!;

  let fullUrl = url;
  if (url.startsWith('/')) {
    fullUrl = `http://localhost:3000${url}`;
  }

  try {
    const response = await fetch(fullUrl, { mode: 'cors' });
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        base64ImageCache.set(url, base64);
        resolve(base64);
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`[PDF Image Fetch Warning] Failed to fetch image: ${url}`, e);
    return url;
  }
}

async function prepareSvgForCanvas(svgStr: string): Promise<string> {
  if (!svgStr) return '';
  const matches = Array.from(svgStr.matchAll(/(?:href|xlink:href)="([^"]+)"/g));
  let preparedSvg = svgStr;

  for (const match of matches) {
    const rawUrl = match[1];
    if (rawUrl && !rawUrl.startsWith('data:')) {
      const b64 = await fetchImageAsBase64(rawUrl);
      if (b64 && b64.startsWith('data:')) {
        preparedSvg = preparedSvg.replaceAll(`href="${rawUrl}"`, `href="${b64}"`);
        preparedSvg = preparedSvg.replaceAll(`xlink:href="${rawUrl}"`, `xlink:href="${b64}"`);
      }
    }
  }
  return preparedSvg;
}

function renderSvgToCanvas(svgString: string, width = 1920, height = 1080): Promise<HTMLCanvasElement> {
  return new Promise(async (resolve, reject) => {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context not available'));

      const img = new Image();
      img.crossOrigin = 'anonymous';

      // Use encodeURIComponent data-URI instead of blob URL to prevent SVG cross-origin security errors
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };

      img.onerror = (err) => {
        console.error('[SVG Canvas Error] Image load failed for SVG data URL:', err);
        reject(new Error('Unable to render SVG onto canvas.'));
      };

      img.src = dataUrl;
    } catch (err) {
      reject(err);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce route protection and load user navbar
  const user = await auth.initAuthGuard(true);
  if (!user) return;
  await initNavbarControls();

  const urlParams = new URLSearchParams(window.location.search);
  const meetingId = urlParams.get('meetingId') || urlParams.get('id');

  if (!meetingId) {
    console.warn("No meeting ID provided in URL parameters.");
    return;
  }

  let currentPresentationData: any = null;
  let activeSlideIndex = 0;

  // Tab Navigation Logic
  const tabs = document.querySelectorAll<HTMLButtonElement>('.nav-tab');
  const panes = document.querySelectorAll<HTMLElement>('.tab-pane');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active-tab'));
      panes.forEach((p) => p.classList.add('hidden'));

      tab.classList.add('active-tab');
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.remove('hidden');
      }
    });
  });

  // Prompt Preset Chips
  const chips = document.querySelectorAll<HTMLButtonElement>('.prompt-chip');
  const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const promptText = chip.textContent?.trim().replace(/^"/, '').replace(/"$/, '') || '';
      if (promptInput) {
        promptInput.value = promptText;
        promptInput.focus();
      }
    });
  });

  // Modal Viewer References
  const modal = document.getElementById('slide-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnPrevSlide = document.getElementById('btn-prev-slide');
  const btnNextSlide = document.getElementById('btn-next-slide');

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (btnPrevSlide) {
    btnPrevSlide.addEventListener('click', () => {
      if (activeSlideIndex > 0) {
        activeSlideIndex--;
        renderModalSlide();
      }
    });
  }

  if (btnNextSlide) {
    btnNextSlide.addEventListener('click', () => {
      const previews = currentPresentationData?.preview_urls || [];
      if (activeSlideIndex < previews.length - 1) {
        activeSlideIndex++;
        renderModalSlide();
      }
    });
  }

  // Keyboard navigation for modal viewer
  document.addEventListener('keydown', (e) => {
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft' && activeSlideIndex > 0) {
      activeSlideIndex--;
      renderModalSlide();
    } else if (e.key === 'ArrowRight') {
      const previews = currentPresentationData?.preview_urls || [];
      if (activeSlideIndex < previews.length - 1) {
        activeSlideIndex++;
        renderModalSlide();
      }
    } else if (e.key === 'Escape') {
      modal.classList.add('hidden');
    }
  });

  function openSlideModal(index: number) {
    activeSlideIndex = index;
    renderModalSlide();
    if (modal) modal.classList.remove('hidden');
  }

  function renderModalSlide() {
    if (!currentPresentationData) return;
    const slides = currentPresentationData.slides_json || currentPresentationData.slides || [];
    const previews = currentPresentationData.preview_urls || [];

    if (slides.length === 0) return;

    const safeIndex = Math.max(0, Math.min(activeSlideIndex, slides.length - 1));
    const currentSlide = slides[safeIndex] || { title: `Slide ${safeIndex + 1}` };
    const currentPreview = previews[safeIndex];

    const modalNum = document.getElementById('modal-slide-num');
    const modalTitle = document.getElementById('modal-slide-title');
    const modalBody = document.getElementById('modal-slide-body');
    const modalIndicator = document.getElementById('modal-slide-indicator');

    if (modalNum) modalNum.textContent = `Slide ${safeIndex + 1}`;
    if (modalTitle) modalTitle.textContent = currentSlide.title || `Slide ${safeIndex + 1}`;
    if (modalIndicator) modalIndicator.textContent = `${safeIndex + 1} of ${slides.length}`;

    if (modalBody) {
      if (currentPreview && typeof currentPreview === 'object' && currentPreview.svg_content) {
        modalBody.innerHTML = currentPreview.svg_content.replace(/width="960"\s+height="540"/g, 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
      } else if (currentPreview && typeof currentPreview === 'object' && currentPreview.preview_url) {
        modalBody.innerHTML = `<img src="${currentPreview.preview_url}" class="max-h-[420px] rounded-lg shadow-xl max-w-full object-contain mx-auto" alt="Slide preview" />`;
      } else if (typeof currentPreview === 'string') {
        modalBody.innerHTML = `<img src="${currentPreview}" class="max-h-[420px] rounded-lg shadow-xl max-w-full object-contain mx-auto" alt="Slide preview" />`;
      } else {
        const slideType = (currentSlide.type || 'bullets').toUpperCase();
        const snippet = getContentSnippet(currentSlide.content);
        modalBody.innerHTML = `
          <div class="w-full max-w-2xl bg-surface-container-lowest border border-outline-variant p-8 rounded-2xl shadow-xl space-y-4 text-left mx-auto">
            <div class="flex justify-between items-center border-b border-outline-variant/40 pb-3">
              <span class="text-xs font-bold text-primary font-mono px-3 py-1 rounded bg-primary/10">${slideType}</span>
              <span class="text-xs font-mono text-on-surface-variant">Slide ${safeIndex + 1} of ${slides.length}</span>
            </div>
            <h3 class="font-display font-bold text-on-surface text-xl">${currentSlide.title || `Slide ${safeIndex + 1}`}</h3>
            ${currentSlide.subtitle ? `<p class="text-xs font-semibold text-primary">${currentSlide.subtitle}</p>` : ''}
            <div class="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap pt-2">${snippet}</div>
          </div>`;
      }
    }
  }

  // Popover Dropdowns (Theme & Download)
  const themePopoverBtn = document.getElementById('theme-popover-btn');
  const themePopoverMenu = document.getElementById('theme-popover-menu');
  const downloadDropdownBtn = document.getElementById('download-dropdown-btn');
  const downloadPopoverMenu = document.getElementById('download-popover-menu');

  if (themePopoverBtn && themePopoverMenu) {
    themePopoverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themePopoverMenu.classList.toggle('hidden');
      if (downloadPopoverMenu) downloadPopoverMenu.classList.add('hidden');
    });
  }

  if (downloadDropdownBtn && downloadPopoverMenu) {
    downloadDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadPopoverMenu.classList.toggle('hidden');
      if (themePopoverMenu) themePopoverMenu.classList.add('hidden');
    });
  }

  document.addEventListener('click', () => {
    if (themePopoverMenu) themePopoverMenu.classList.add('hidden');
    if (downloadPopoverMenu) downloadPopoverMenu.classList.add('hidden');
  });

  // Theme Option Handler (Reuses existing updateTheme API handler)
  document.querySelectorAll<HTMLButtonElement>('.theme-option-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const selectedTheme = btn.getAttribute('data-theme');
      if (!selectedTheme) return;
      if (themePopoverMenu) themePopoverMenu.classList.add('hidden');

      try {
        await api.updateTheme(meetingId!, selectedTheme);
        await loadPresentation();
        showToast(`Theme updated to ${selectedTheme.replace(/_/g, ' ').toUpperCase()}`, 'success');
      } catch (err) {
        console.error("Failed to update theme:", err);
        showToast("Failed to update theme", 'error');
      }
    });
  });

  // Regenerate Presentation Handler
  const btnRegenerate = document.getElementById('btn-regenerate-deck') as HTMLButtonElement;
  if (btnRegenerate) {
    btnRegenerate.addEventListener('click', async () => {
      try {
        btnRegenerate.disabled = true;
        btnRegenerate.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Rebuilding...';
        await api.regeneratePresentation(meetingId!);
        await loadPresentation();
        showToast("Presentation deck regenerated successfully.", 'success');
      } catch (err) {
        console.error("Regenerate deck failed:", err);
        showToast("Failed to regenerate slide deck.", 'error');
      } finally {
        btnRegenerate.disabled = false;
        btnRegenerate.innerHTML = '<span class="material-symbols-outlined text-sm text-primary">sync</span> Regenerate';
      }
    });
  }

  // =========================================================================
  // PDF EXPORT HANDLER (Direct Server Endpoint + Client JS Fallback)
  // =========================================================================
  const btnPdf = document.getElementById('btn-download-pdf') as HTMLAnchorElement;
  if (btnPdf) {
    btnPdf.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentPresentationData || btnPdf.getAttribute('data-processing') === 'true') return;

      const originalHtml = btnPdf.innerHTML;
      try {
        btnPdf.setAttribute('data-processing', 'true');
        btnPdf.classList.add('opacity-75', 'cursor-not-allowed');
        btnPdf.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Generating PDF...';

        // Direct backend PDF generator URL
        const backendPdfUrl = api.getDownloadUrl(meetingId!, 'pdf');

        // Try direct backend download first
        const resp = await fetch(backendPdfUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob && blob.size > 0) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const cleanMeetingName = (currentPresentationData.meeting_name || currentPresentationData.title || 'Presentation')
              .replace(/[^a-zA-Z0-9_-]/g, '_');
            const pdfFileName = `${cleanMeetingName}_${dateStr}.pdf`;

            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = pdfFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            showToast('PDF generated successfully.', 'success');
            return;
          }
        }

        // Fallback: Client-side jsPDF generation
        const previews = currentPresentationData.preview_urls || [];
        if (previews.length === 0) {
          throw new Error('No slide previews available for PDF generation');
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const cleanMeetingName = (currentPresentationData.meeting_name || currentPresentationData.title || 'Presentation')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        const pdfFileName = `${cleanMeetingName}_${dateStr}.pdf`;

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [1920, 1080],
          compress: true
        });

        for (let idx = 0; idx < previews.length; idx++) {
          const prev = previews[idx];
          const rawSvg = typeof prev === 'string' ? prev : prev?.svg_content;
          if (!rawSvg) continue;

          const inlineSvg = await prepareSvgForCanvas(rawSvg);
          const canvas = await renderSvgToCanvas(inlineSvg, 1920, 1080);
          const imgData = canvas.toDataURL('image/jpeg', 0.92);

          if (idx > 0) {
            pdf.addPage([1920, 1080], 'landscape');
          }
          pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
        }

        pdf.save(pdfFileName);
        showToast('PDF generated successfully.', 'success');

      } catch (err: any) {
        console.error('[PDF Export Error]', err);
        // Direct link fallback
        window.location.href = api.getDownloadUrl(meetingId!, 'pdf');
      } finally {
        btnPdf.removeAttribute('data-processing');
        btnPdf.classList.remove('opacity-75', 'cursor-not-allowed');
        btnPdf.innerHTML = originalHtml;
      }
    });
  }

  // =========================================================================
  // TRANSCRIPT DOCX EXPORT HANDLER
  // =========================================================================
  const btnDocx = document.getElementById('btn-download-docx') as HTMLAnchorElement;
  if (btnDocx) {
    btnDocx.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!meetingId) return;

      const originalHtml = btnDocx.innerHTML;
      try {
        btnDocx.classList.add('opacity-75', 'cursor-not-allowed');
        btnDocx.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> Generating DOCX...';

        const docxUrl = api.getTranscriptDocxUrl(meetingId);
        const resp = await fetch(docxUrl);

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Transcript not available for download.');
        }

        const blob = await resp.blob();
        if (!blob || blob.size < 10) {
          throw new Error('Transcript not available for download.');
        }

        const rawName = currentPresentationData?.meeting_name || currentPresentationData?.file_name || 'audio_recording';
        const cleanName = rawName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `transcript_${cleanName}.docx`;

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);

        showToast('Transcript downloaded successfully (.docx)', 'success');
      } catch (err: any) {
        console.error('[DOCX Download Error]', err);
        showToast(err.message || 'Transcript not available for download.', 'error');
      } finally {
        btnDocx.classList.remove('opacity-75', 'cursor-not-allowed');
        btnDocx.innerHTML = originalHtml;
      }
    });
  }

  // =========================================================================
  // IMAGES ZIP EXPORT HANDLER (JSZip + PNG)
  // =========================================================================
  const btnImages = document.getElementById('btn-download-images') as HTMLAnchorElement;
  if (btnImages) {
    btnImages.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentPresentationData || btnImages.getAttribute('data-processing') === 'true') return;

      const originalHtml = btnImages.innerHTML;
      try {
        btnImages.setAttribute('data-processing', 'true');
        btnImages.classList.add('opacity-75', 'cursor-not-allowed');

        const previews = currentPresentationData.preview_urls || [];
        if (previews.length === 0) {
          throw new Error('No slide previews available for image export');
        }

        const zip = new JSZip();
        const cleanMeetingName = (currentPresentationData.meeting_name || currentPresentationData.title || 'Presentation')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        const zipFileName = `${cleanMeetingName}_Slides.zip`;

        for (let idx = 0; idx < previews.length; idx++) {
          const percent = Math.round(((idx + 1) / previews.length) * 100);
          btnImages.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Exporting slide images (${percent}%)...`;

          const prev = previews[idx];
          const rawSvg = prev.svg_content;
          if (!rawSvg) continue;

          const inlineSvg = await prepareSvgForCanvas(rawSvg);
          const canvas = await renderSvgToCanvas(inlineSvg, 1920, 1080);
          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

          const slideNumStr = String(idx + 1).padStart(2, '0');
          zip.file(`Slide_${slideNumStr}.png`, base64Data, { base64: true });
        }

        btnImages.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Creating ZIP package...`;
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showToast('Images exported successfully.', 'success');

      } catch (err: any) {
        console.error('Images export error:', err);
        showToast(err.message || 'Failed to export slide images.', 'error');
      } finally {
        btnImages.removeAttribute('data-processing');
        btnImages.classList.remove('opacity-75', 'cursor-not-allowed');
        btnImages.innerHTML = originalHtml;
      }
    });
  }

  // Load Full Presentation Data
  async function loadPresentation() {
    try {
      const response = await api.getPresentation(meetingId!);
      if (!response.success || !response.presentation) {
        console.error("Failed to load presentation details.");
        return;
      }

      currentPresentationData = response.presentation;
      const p = currentPresentationData;

      // =====================================================================
      // DASHBOARD GATE — only bounce to processing if genuinely not ready.
      // CRITICAL: Do NOT require pptx_url or preview_urls — they may not
      // exist on first load but the presentation is still displayable.
      // Only redirect if: status is not 'completed' AND slides are missing.
      // =====================================================================
      const hasSlides = Boolean((p.slides_json && p.slides_json.length > 0) || (p.slides && p.slides.length > 0));
      const isCompleted = p.status === 'completed';

      console.log('[Dashboard] Presentation loaded:', {
        status: p.status,
        isCompleted,
        hasSlides,
        slideCount: (p.slides_json || p.slides || []).length,
        hasPptxUrl: Boolean(p.pptx_url),
        hasPreviewUrls: Boolean(p.preview_urls?.length)
      });

      // Loop-guard: if we just came FROM processing (sessionStorage flag set),
      // never redirect back — break the loop unconditionally.
      const cameFromProcessing = sessionStorage.getItem(`ppt_ready_${meetingId}`) === 'true';

      if (!cameFromProcessing && (!isCompleted || !hasSlides)) {
        // Genuinely not ready — send to processing. Set a bounce-guard so
        // processing can set the flag and we never bounce here again.
        console.warn('[Dashboard] Presentation not ready. Status:', p.status, '| hasSlides:', hasSlides, '| Redirecting to processing...');
        window.location.href = `processing.html?meetingId=${meetingId}`;
        return;
      }

      // If we reach here — slides exist OR we came from processing — show the dashboard.
      console.log('[Dashboard] Presentation loaded. Slides:', (p.slides_json || p.slides || []).length);

      // Update Header Pills & Sidebar Title
      const sidebarName = document.getElementById('sidebar-meeting-name');
      const versionBadge = document.getElementById('sidebar-version-badge');
      const genTimeCount = document.getElementById('gen-time-count');
      const currentThemeBadge = document.getElementById('current-theme-badge');

      if (sidebarName) sidebarName.textContent = p.meeting_name || p.title || 'Meeting Presentation';
      if (versionBadge) {
        const latestVersion = p.versions?.[0]?.version_number || 1;
        versionBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-success"></span> Version ${latestVersion} (Active)`;
      }

      if (genTimeCount) {
        const seconds = p.generation_time_ms ? (p.generation_time_ms / 1000).toFixed(1) : '2.4';
        genTimeCount.textContent = `Time: ${seconds}s`;
      }
      if (currentThemeBadge) {
        const themeDisplay = (p.theme || 'executive_blue').replace(/_/g, ' ').toUpperCase();
        currentThemeBadge.textContent = `Theme: ${themeDisplay}`;
      }

      // Update PPTX Download Link
      const btnPptx = document.getElementById('btn-download-pptx') as HTMLAnchorElement;
      if (btnPptx) btnPptx.href = api.getDownloadUrl(meetingId!, 'pptx');

      // Render Slide Thumbnails Grid
      const thumbnailsGrid = document.getElementById('preview-thumbnails-grid');
      const totalSlidesCount = document.getElementById('total-slides-count');
      const slides = p.slides_json || p.slides || [];
      const previews = p.preview_urls || [];

      console.log(`[PRESENTATION DEBUG] Dashboard fetched ${slides.length} slides, ${previews.length} previews`);

      if (totalSlidesCount) totalSlidesCount.textContent = `${slides.length} Slides`;

      const langBadge = document.getElementById('detected-language-badge');
      if (langBadge) {
        const lang = p.detected_language || 'English';
        langBadge.innerHTML = `<span class="material-symbols-outlined text-sm">translate</span> Detected Language: ${lang}`;
      }

      if (thumbnailsGrid) {
        thumbnailsGrid.innerHTML = '';

        if (slides.length === 0) {
          thumbnailsGrid.innerHTML = `
            <div class="col-span-full p-8 text-center bg-surface-container-low rounded-2xl border border-outline-variant/60">
              <p class="text-on-surface font-semibold text-base mb-1">Presentation content could not be generated.</p>
              <p class="text-on-surface-variant text-xs mb-4">Click Regenerate to process meeting audio again.</p>
            </div>`;
        } else {
          slides.forEach((slideItem: any, idx: number) => {
            const prev = previews[idx];
            let visualContent = '';

            if (prev) {
              if (typeof prev === 'object' && prev.svg_content) {
                visualContent = prev.svg_content.replace(/width="960"\s+height="540"/g, 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
              } else if (typeof prev === 'object' && prev.preview_url) {
                visualContent = `<img src="${prev.preview_url}" class="max-h-full max-w-full rounded shadow object-contain" alt="Slide ${idx + 1}" />`;
              } else if (typeof prev === 'string') {
                visualContent = `<img src="${prev}" class="max-h-full max-w-full rounded shadow object-contain" alt="Slide ${idx + 1}" />`;
              }
            }

            if (!visualContent) {
              const slideType = (slideItem.type || 'bullets').toUpperCase();
              const snippet = getContentSnippet(slideItem.content);
              visualContent = `
                <div class="w-full h-full p-4 bg-surface-container-lowest border border-outline-variant/40 rounded-xl flex flex-col justify-between text-left">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-primary font-mono px-2 py-0.5 rounded bg-primary/10">${slideType}</span>
                    <span class="text-[10px] font-mono text-on-surface-variant">0${idx + 1}</span>
                  </div>
                  <h5 class="font-bold text-on-surface text-xs line-clamp-2 my-1">${slideItem.title || `Slide ${idx + 1}`}</h5>
                  <p class="text-[11px] text-on-surface-variant line-clamp-3 leading-tight">${snippet}</p>
                </div>`;
            }

            const contentText = getContentSnippet(slideItem.content);

            const card = document.createElement('div');
            card.className = 'bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:border-primary transition-all cursor-pointer shadow-sm group';

            card.innerHTML = `
              <div class="p-3 bg-surface-container-low border-b border-outline-variant/60 flex items-center justify-between">
                <span class="text-xs font-semibold text-primary font-mono">Slide ${idx < 9 ? '0' : ''}${idx + 1}</span>
                <span class="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">fullscreen</span> Expand
                </span>
              </div>
              <div class="p-4 bg-surface-container-low flex justify-center items-center h-48 overflow-hidden">
                ${visualContent}
              </div>
              <div class="p-4 border-t border-outline-variant/40 bg-surface-container-lowest">
                <h4 class="font-semibold text-on-surface text-sm truncate">${slideItem.title || `Slide ${idx + 1}`}</h4>
                <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${contentText}</p>
              </div>
            `;

            card.addEventListener('click', () => openSlideModal(idx));
            thumbnailsGrid.appendChild(card);
          });
        }
      }

      // Render Executive Summary
      const summaryText = document.getElementById('summary-content-text');
      console.log('[Dashboard] Summary data:', p.summary ? `${p.summary.length} chars` : 'EMPTY/NULL');
      if (summaryText) {
        if (p.summary && p.summary.trim().length > 0) {
          summaryText.textContent = p.summary;
          summaryText.className = summaryText.className.replace('text-on-surface-variant', 'text-on-surface');
        } else {
          summaryText.innerHTML = '<span class="text-on-surface-variant italic">Summary is being generated... Please refresh in a moment.</span>';
        }
      }

      // 4. Update Transcript Tab
      const transcriptText = document.getElementById('transcript-full-text');
      console.log('[Dashboard] Transcript data:', p.transcript ? `${p.transcript.length} chars` : 'EMPTY/NULL');
      if (transcriptText) {
        if (p.transcript && p.transcript.trim().length > 0) {
          transcriptText.textContent = p.transcript;
        } else {
          transcriptText.innerHTML = '<span class="text-on-surface-variant italic">Transcript is being generated... Please refresh in a moment.</span>';
        }
      }

      // Render Action Items
      const actionItemsList = document.getElementById('action-items-list');
      if (actionItemsList) {
        actionItemsList.innerHTML = '';
        const items = p.action_items || [];
        if (items.length === 0) {
          actionItemsList.innerHTML = '<p class="text-xs text-on-surface-variant">No pending action items.</p>';
        } else {
          items.forEach((item: any) => {
            const div = document.createElement('div');
            div.className = 'p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex justify-between items-center';
            div.innerHTML = `
              <div>
                <p class="text-sm font-medium text-on-surface">${item.task}</p>
                <p class="text-xs text-on-surface-variant">Assignee: ${item.person} • Priority: <span class="text-primary font-semibold">${item.priority}</span></p>
              </div>
              <span class="text-xs bg-primary-fixed text-primary px-2.5 py-1 rounded-full font-semibold">${item.status}</span>
            `;
            actionItemsList.appendChild(div);
          });
        }
      }

      // Render Speakers
      const speakersList = document.getElementById('speakers-list');
      if (speakersList) {
        speakersList.innerHTML = '';
        const spks = p.speakers || [];
        if (spks.length === 0) {
          speakersList.innerHTML = '<p class="text-xs text-on-surface-variant">No speakers detected.</p>';
        } else {
          spks.forEach((spk: any) => {
            const div = document.createElement('div');
            div.className = 'p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex justify-between items-center';
            div.innerHTML = `
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center">${spk.speaker_name.charAt(0)}</span>
                <span class="text-sm font-medium text-on-surface">${spk.speaker_name}</span>
              </div>
              <span class="text-xs text-on-surface-variant font-mono">${spk.total_duration_seconds}s spoken</span>
            `;
            speakersList.appendChild(div);
          });
        }
      }

      // Render Version History
      const versionsContainer = document.getElementById('versions-list-container');
      if (versionsContainer) {
        versionsContainer.innerHTML = '';
        const versions = p.versions || [];
        versions.forEach((v: any) => {
          const card = document.createElement('div');
          card.className = 'bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex justify-between items-center shadow-sm';
          card.innerHTML = `
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-on-surface text-base">Version ${v.version_number}</span>
                ${v.version_number === (versions[0]?.version_number || 1) ? '<span class="bg-success-container text-on-success-container text-xs px-2.5 py-0.5 rounded-full font-semibold">Active</span>' : ''}
              </div>
              <p class="text-xs text-on-surface-variant mt-1">Prompt: "${v.prompt || 'Original Deck'}"</p>
              <p class="text-xs text-outline mt-1 font-mono">${new Date(v.created_at).toLocaleString()}</p>
            </div>
            <div>
              <button class="btn-rollback bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all" data-version="${v.version_number}">
                <span class="material-symbols-outlined text-sm">history</span> Restore Version ${v.version_number}
              </button>
            </div>
          `;
          versionsContainer.appendChild(card);
        });

        // Add rollback button handlers
        document.querySelectorAll<HTMLButtonElement>('.btn-rollback').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const verNum = parseInt(btn.getAttribute('data-version') || '1', 10);
            try {
              btn.disabled = true;
              btn.textContent = "Restoring version...";
              await api.rollbackPresentation(meetingId!, verNum);
              await loadPresentation();
              showToast(`Restored to Version ${verNum}.`, 'success');
            } catch (err) {
              console.error("Rollback failed", err);
              showToast("Failed to restore version.", 'error');
            }
          });
        });
      }

    } catch (err) {
      console.error("Failed to load presentation", err);
    }
  }

  // Handle Presentation Edit Form Submission ("Modify Presentation")
  const formModify = document.getElementById('form-modify-presentation') as HTMLFormElement;
  const btnSubmitModify = document.getElementById('btn-submit-modify') as HTMLButtonElement;

  if (formModify) {
    formModify.addEventListener('submit', async (e) => {
      e.preventDefault();
      const promptValue = promptInput.value.trim();
      if (!promptValue) return;

      try {
        if (btnSubmitModify) {
          btnSubmitModify.disabled = true;
          btnSubmitModify.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> AI Updating Presentation...';
        }

        const result = await api.modifyPresentation(meetingId!, promptValue);
        console.log("Modify result:", result);

        promptInput.value = '';
        await loadPresentation();
        showToast("Presentation updated with AI changes.", 'success');

        // Switch to Slide Previews tab
        const slideTabBtn = document.querySelector<HTMLButtonElement>('[data-tab="tab-slides"]');
        if (slideTabBtn) slideTabBtn.click();

      } catch (err) {
        console.error("Failed to modify presentation", err);
        showToast("Failed to modify presentation.", 'error');
      } finally {
        if (btnSubmitModify) {
          btnSubmitModify.disabled = false;
          btnSubmitModify.innerHTML = '<span class="material-symbols-outlined text-base">auto_fix_high</span> Apply AI Changes';
        }
      }
    });
  }

  // Initial Load
  await loadPresentation();
});
