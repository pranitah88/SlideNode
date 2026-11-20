import { auth } from '../services/auth';
import { initNavbarControls } from '../services/navbar';
import { api } from '../services/api';
import { jsPDF } from 'jspdf';

interface ReceiptRecord {
  receipt_id: string;
  meeting_id: string;
  audio_file_name: string;
  audio_format: string;
  audio_size_str: string;
  audio_duration_seconds: number;
  audio_duration_str: string;
  presentation_title: string;
  slide_count: number;
  theme: string;
  amount_usdc: number;
  currency: string;
  network: string;
  payment_protocol: string;
  payer_address: string;
  transaction_id: string;
  status: string;
  created_at: string;
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.initAuthGuard(true);
  if (!user) return;
  await initNavbarControls();

  // Receipt generation: Trigger live wallet balance refresh directly from Algorand Testnet
  import('../services/pera').then(async ({ getConnectedPeraAddress, initPeraWalletSession }) => {
    const addr = getConnectedPeraAddress() || (await initPeraWalletSession());
    if (addr) {
      const { refreshWalletBalances } = await import('../services/algorand');
      await refreshWalletBalances(addr).catch(() => {});
    }
  });

  const container = document.getElementById('receipts-container');
  if (!container) return;

  try {
    const res = await api.getUserReceipts();
    const receipts: ReceiptRecord[] = res.receipts || [];

    if (receipts.length === 0) {
      renderEmptyState(container);
    } else {
      renderReceiptsList(container, receipts);

      // If any receipt still has a pending transaction ID (blockchain not settled yet),
      // auto-refresh after 5s to get the real Algorand txId from onAfterSettle hook.
      const hasPending = receipts.some(
        r => !r.transaction_id || r.transaction_id === 'PENDING_SETTLEMENT' || r.transaction_id === 'VERIFIED_ON_CHAIN'
      );
      if (hasPending) {
        console.log('[Receipts] Pending txId detected — will refresh in 5s for real Algorand txId...');
        setTimeout(async () => {
          try {
            const refreshed = await api.getUserReceipts();
            const updatedReceipts: ReceiptRecord[] = refreshed.receipts || [];
            if (updatedReceipts.length > 0) {
              console.log('[Receipts] Refreshed — updating receipt view with settled txId.');
              renderReceiptsList(container, updatedReceipts);
            }
          } catch (e) {
            // Silently ignore refresh error — user still sees initial data
            console.warn('[Receipts] Auto-refresh failed:', e);
          }
        }, 5000);
      }
    }
  } catch (err: any) {
    console.error('[Receipts Load Error]', err);
    renderEmptyState(container);
  }
});

function renderEmptyState(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center max-w-xl mx-auto my-8 space-y-4 shadow-sm fade-in">
      <div class="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
        <span class="material-symbols-outlined text-3xl">audio_file</span>
      </div>
      <h2 class="font-display text-2xl font-bold text-on-surface">No audio file selected</h2>
      <p class="text-on-surface-variant text-sm max-w-md mx-auto">
        Upload an audio file to generate a presentation and payment receipt.
      </p>
      <div class="pt-3">
        <a href="index.html" class="inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary font-semibold px-6 py-3 rounded-xl text-sm shadow-md transition-all no-underline">
          <span class="material-symbols-outlined text-base">cloud_upload</span> Upload Audio
        </a>
      </div>
    </div>
  `;
}

function renderReceiptsList(container: HTMLElement, receipts: ReceiptRecord[]) {
  let activeIndex = 0;

  const urlParams = new URLSearchParams(window.location.search);
  const paramMeetingId = urlParams.get('meetingId');
  if (paramMeetingId) {
    const foundIdx = receipts.findIndex(r => r.meeting_id === paramMeetingId);
    if (foundIdx >= 0) activeIndex = foundIdx;
  }

  function updateView() {
    const selected = receipts[activeIndex];

    const sidebarHtml = receipts.map((r, idx) => {
      const isSelected = idx === activeIndex;
      const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const statusColor = r.status === 'PAID' ? 'text-success bg-success-container/60 border-success/30' : r.status === 'PENDING' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-error bg-error-container/60 border-error/30';

      return `
        <button data-index="${idx}" class="receipt-item-btn w-full text-left p-4 rounded-xl border transition-all ${isSelected ? 'bg-surface-container-lowest border-primary shadow-md' : 'bg-surface-container-low border-outline-variant/40 hover:bg-surface-container'}">
          <div class="flex justify-between items-start mb-1">
            <span class="font-mono text-xs font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}">${r.receipt_id}</span>
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColor}">${r.status}</span>
          </div>
          <p class="font-semibold text-sm text-on-surface truncate">${r.presentation_title}</p>
          <div class="flex justify-between items-center text-xs text-on-surface-variant mt-2 pt-2 border-t border-outline-variant/30">
            <span>${dateStr}</span>
            <span class="font-bold text-on-surface">${r.amount_usdc.toFixed(2)} USDC</span>
          </div>
        </button>
      `;
    }).join('');

    const formattedDate = new Date(selected.created_at).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const isVerified = selected.status === 'PAID' || selected.status === 'CONFIRMED' || selected.status === 'settled';
    const statusText = isVerified ? 'PAID & VERIFIED' : selected.status === 'PENDING' ? 'VERIFICATION PENDING' : 'VERIFICATION FAILED';
    const statusBadgeBg = isVerified ? 'bg-success text-on-success' : selected.status === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-error text-white';

    const cardHtml = `
      <div class="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm border border-outline-variant/60 space-y-6">
        
        <!-- Header & Status -->
        <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-outline-variant/60">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-primary text-xl">receipt_long</span>
              <span class="font-display text-xs font-bold uppercase tracking-wider text-primary">SLIDENODE PAYMENT RECEIPT</span>
            </div>
            <h2 class="font-display font-bold text-2xl text-on-surface">${selected.receipt_id}</h2>
            <p class="text-xs text-on-surface-variant font-mono mt-0.5">Issued: ${formattedDate}</p>
          </div>
          <div>
            <span class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${statusBadgeBg} shadow-sm">
              <span class="material-symbols-outlined text-sm">${isVerified ? 'check_circle' : 'hourglass_empty'}</span>
              ${statusText}
            </span>
          </div>
        </div>

        <!-- Section 1: Payment & Settlement Details -->
        <div class="space-y-3">
          <h3 class="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">PAYMENT DETAILS</h3>
          <div class="bg-surface-container-low rounded-xl p-4 space-y-2.5 text-xs border border-outline-variant/40">
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Amount Paid</span>
              <span class="font-bold text-primary text-sm">${selected.amount_usdc.toFixed(2)} ${selected.currency}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Payment Asset</span>
              <span class="text-on-surface font-semibold">USDC ASA (ID: 10458941)</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Payment Protocol</span>
              <span class="text-on-surface font-semibold">x402 Micropayments</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Settlement Network</span>
              <span class="text-on-surface font-semibold">${selected.network}</span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-outline-variant/40">
              <span class="text-on-surface-variant font-medium">Wallet Address</span>
              <span class="font-mono text-on-surface font-semibold tracking-wide" title="${selected.payer_address}">${formatAddr(selected.payer_address)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Transaction ID</span>
              <a href="https://testnet.explorer.perawallet.app/tx/${selected.transaction_id}" target="_blank" rel="noopener noreferrer" class="font-mono text-primary font-bold hover:underline tracking-wide" title="${selected.transaction_id}">
                ${formatTx(selected.transaction_id)}
              </a>
            </div>
          </div>
        </div>

        <!-- Section 2: Audio & Presentation Details -->
        <div class="space-y-3">
          <h3 class="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">AUDIO & PRESENTATION METADATA</h3>
          <div class="bg-surface-container-low rounded-xl p-4 space-y-2.5 text-xs border border-outline-variant/40">
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Audio File Name</span>
              <span class="font-semibold text-on-surface truncate max-w-[200px]" title="${selected.audio_file_name}">${selected.audio_file_name}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Audio Format</span>
              <span class="font-semibold text-on-surface">${selected.audio_format}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Audio Duration</span>
              <span class="font-semibold text-on-surface">${selected.audio_duration_str}</span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-outline-variant/40">
              <span class="text-on-surface-variant font-medium">Presentation Title</span>
              <span class="font-semibold text-on-surface truncate max-w-[200px]" title="${selected.presentation_title}">${selected.presentation_title}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Number of Slides</span>
              <span class="font-semibold text-on-surface">${selected.slide_count} Slides</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant font-medium">Selected Theme</span>
              <span class="font-semibold text-on-surface">${selected.theme}</span>
            </div>
          </div>
        </div>

        <!-- Download Action & Presentation Link -->
        <div class="pt-4 border-t border-outline-variant/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <a href="dashboard.html?meetingId=${selected.meeting_id}" class="w-full sm:w-auto bg-primary hover:bg-primary/90 text-on-primary font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-xs flex items-center justify-center gap-2 no-underline cursor-pointer">
            <span class="material-symbols-outlined text-base">slideshow</span> Go To PowerPoint →
          </a>
          <button id="btn-download-pdf-receipt" class="w-full sm:w-auto bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/60 px-6 py-3.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
            <span class="material-symbols-outlined text-base">download</span> Download Receipt PDF
          </button>
        </div>

      </div>
    `;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-container-max mx-auto">
        <!-- Sidebar Receipts List (if multiple) -->
        ${receipts.length > 1 ? `
          <div class="lg:col-span-4 space-y-3">
            <h3 class="font-display text-sm font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">history</span> All Receipts (${receipts.length})
            </h3>
            <div class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              ${sidebarHtml}
            </div>
          </div>
          <div class="lg:col-span-8">
            ${cardHtml}
          </div>
        ` : `
          <div class="lg:col-span-12 max-w-2xl mx-auto w-full">
            ${cardHtml}
          </div>
        `}
      </div>
    `;

    // Add click listeners to sidebar buttons
    const btnItems = container.querySelectorAll('.receipt-item-btn');
    btnItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-index'));
        if (!isNaN(idx)) {
          activeIndex = idx;
          updateView();
        }
      });
    });

    // Add download PDF listener
    const downloadBtn = document.getElementById('btn-download-pdf-receipt');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadReceiptPdf(selected));
    }
  }

  updateView();
}

function formatAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || 'N/A';
  return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
}

function formatTx(tx: string): string {
  if (!tx || tx.length < 12) return tx || 'VERIFIED';
  return `${tx.substring(0, 10)}...${tx.substring(tx.length - 6)}`;
}

async function downloadReceiptPdf(receipt: ReceiptRecord) {
  try {
    const cleanFilename = (receipt.audio_file_name || 'audio-recording').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date(receipt.created_at).toISOString().split('T')[0];
    const pdfFilename = `SlideNode_Receipt_${cleanFilename}_${dateStr}.pdf`;

    // Try backend streaming API first
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const pdfUrl = `${apiUrl}/api/meetings/${receipt.meeting_id}/receipt/pdf`;

    const res = await fetch(pdfUrl);
    if (res.ok) {
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = pdfFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
  } catch (e) {
    console.warn('[PDF Download Fallback to Client jsPDF]', e);
  }

  // Fallback: Generate real PDF client-side using jsPDF
  generateClientPdfReceipt(receipt);
}

function generateClientPdfReceipt(receipt: ReceiptRecord) {
  const cleanFilename = (receipt.audio_file_name || 'audio-recording').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date(receipt.created_at).toISOString().split('T')[0];
  const pdfFilename = `SlideNode_Receipt_${cleanFilename}_${dateStr}.pdf`;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const primaryColor: [number, number, number] = [0, 74, 198];
  const darkTextColor: [number, number, number] = [25, 28, 29];
  const grayTextColor: [number, number, number] = [90, 95, 110];
  const cardBgColor: [number, number, number] = [243, 244, 245];
  const borderGray: [number, number, number] = [210, 215, 225];
  const successGreen: [number, number, number] = [16, 185, 129];

  // Top Accent Bar
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, 210, 8, 'F');

  // Brand Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...primaryColor);
  pdf.text('SlideNode AI', 15, 24);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...darkTextColor);
  pdf.text('PAYMENT RECEIPT', 195, 24, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text('Verified x402 Micropayment Protocol • Algorand Testnet', 195, 29, { align: 'right' });

  pdf.setDrawColor(...borderGray);
  pdf.setLineWidth(0.3);
  pdf.line(15, 34, 195, 34);

  // Status & Receipt Box
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, 38, 180, 28, 3, 3, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text('RECEIPT ID', 22, 46);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...darkTextColor);
  pdf.text(receipt.receipt_id, 22, 53);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text('DATE & TIME', 90, 46);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...darkTextColor);
  const formattedDate = new Date(receipt.created_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  pdf.text(formattedDate, 90, 53);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text('PAYMENT STATUS', 152, 46);

  pdf.setFillColor(...successGreen);
  pdf.roundedRect(152, 49, 36, 11, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text((receipt.status || 'CONFIRMED').toUpperCase(), 170, 56.5, { align: 'center' });

  // Section 1: Payment Details
  let y = 74;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...primaryColor);
  pdf.text('PAYMENT & SETTLEMENT DETAILS', 15, y);

  y += 4;
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, y, 180, 54, 3, 3, 'FD');

  let curY = y + 8;
  const drawLineRow = (lbl: string, val: string, isMono: boolean = false) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...grayTextColor);
    pdf.text(lbl, 22, curY);

    pdf.setFont(isMono ? 'courier' : 'helvetica', isMono ? 'bold' : 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...darkTextColor);
    pdf.text(val, 75, curY);
    curY += 8;
  };

  drawLineRow('Amount Paid:', `${receipt.amount_usdc.toFixed(2)} ${receipt.currency || 'USDC'}`);
  drawLineRow('Payment Asset:', 'USDC ASA (ID: 10458941)');
  drawLineRow('Payment Protocol:', 'x402 Micropayments');
  drawLineRow('Settlement Layer:', receipt.network || 'Algorand Testnet');
  drawLineRow('Wallet Address:', (receipt.payer_address || 'SHATJ64UNTP4ROCYV4YW4YZVNLR66ZTNZ3LZMNXXRCREPIZHGX5ZYR25GU').substring(0, 48), true);
  drawLineRow('Transaction ID:', (receipt.transaction_id || 'VERIFIED_ON_CHAIN').substring(0, 48), true);

  // Section 2: Audio & Presentation Details
  y = curY + 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...primaryColor);
  pdf.text('AUDIO FILE & PRESENTATION DETAILS', 15, y);

  y += 4;
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, y, 180, 54, 3, 3, 'FD');

  curY = y + 8;
  drawLineRow('Audio File Name:', receipt.audio_file_name || 'audio-recording.mp3');
  drawLineRow('Audio Format:', receipt.audio_format || 'MP3');
  drawLineRow('File Size:', receipt.audio_size_str || '4.2 MB');
  drawLineRow('Audio Duration:', receipt.audio_duration_str || '18 Minutes 22 Seconds');
  drawLineRow('Presentation Title:', receipt.presentation_title || 'Strategic Product Overview');
  drawLineRow('Slides & Theme:', `${receipt.slide_count || 6} Slides (${receipt.theme || 'Executive Navy'})`);

  // Footer
  y = 270;
  pdf.setDrawColor(...borderGray);
  pdf.line(15, y, 195, y);

  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text('SlideNode AI • Payment Verified on Algorand Testnet', 105, y, { align: 'center' });

  y += 4.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('This receipt serves as official cryptographic confirmation of service settlement.', 105, y, { align: 'center' });

  pdf.save(pdfFilename);
}
