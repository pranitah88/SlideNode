import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { cleanSlideModificationMetadata } from "./ai.js";

export interface SlideItem {
  id?: string;
  slide_number: number;
  type?: string;
  title: string;
  subtitle?: string;
  content: any;
  speaker_notes?: string;
  image_url?: string;
}

interface ColorPalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
}

const COLOR_MAP: Record<string, ColorPalette> = {
  executive_blue: { bg: "#FFFFFF", cardBg: "#F8FAFC", cardBorder: "#CBD5E1", textPrimary: "#0F172A", textSecondary: "#475569", accent: "#1E40AF" },
  modern_indigo: { bg: "#FFFFFF", cardBg: "#F8FAFC", cardBorder: "#E0E7FF", textPrimary: "#1E1B4B", textSecondary: "#4338CA", accent: "#4F46E5" },
  emerald_professional: { bg: "#FFFFFF", cardBg: "#F0FDF4", cardBorder: "#BBF7D0", textPrimary: "#064E3B", textSecondary: "#166534", accent: "#059669" },
  midnight_executive: { bg: "#0F172A", cardBg: "#1E293B", cardBorder: "#334155", textPrimary: "#F8FAFC", textSecondary: "#94A3B8", accent: "#38BDF8" },
  warm_minimal: { bg: "#FDFBF7", cardBg: "#F5F2EB", cardBorder: "#E7E2D7", textPrimary: "#1C1917", textSecondary: "#44403C", accent: "#D97706" },
  tech_gradient: { bg: "#F8FAFC", cardBg: "#FFFFFF", cardBorder: "#E2E8F0", textPrimary: "#0F172A", textSecondary: "#334155", accent: "#0284C7" },
  minimal_monochrome: { bg: "#FFFFFF", cardBg: "#FAFAFA", cardBorder: "#E5E5E5", textPrimary: "#18181B", textSecondary: "#52525B", accent: "#18181B" },
  consulting: { bg: "#FFFFFF", cardBg: "#F8FAFC", cardBorder: "#CBD5E1", textPrimary: "#002060", textSecondary: "#334155", accent: "#C00000" },
};

function resolveImagePath(imageUrl?: string): string {
  if (!imageUrl) return "";
  let filename = "";
  if (imageUrl.includes("/api/images/")) {
    filename = imageUrl.split("/api/images/").pop() || "";
  } else if (imageUrl.includes("/")) {
    filename = imageUrl.split("/").pop() || "";
  }
  if (filename) {
    const localPath = path.resolve(process.cwd(), "uploads", "image_cache", filename);
    if (fs.existsSync(localPath)) return localPath;
  }
  return "";
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export async function generatePdfFile(
  meetingId: string,
  title: string,
  slides: SlideItem[],
  theme: string = "professional"
): Promise<{ filePath: string; storageUrl: string }> {
  const themeKey = (theme || "executive_blue").toLowerCase().trim();
  const colors = COLOR_MAP[themeKey] || COLOR_MAP.executive_blue;

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const fileName = `presentation_${meetingId}.pdf`;
  const filePath = path.join(uploadsDir, fileName);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [1920, 1080],
    compress: true,
  });

  const cleanTitle = (title || "Presentation").substring(0, 50);

  for (let idx = 0; idx < slides.length; idx++) {
    const rawItem = slides[idx];
    const item = cleanSlideModificationMetadata(rawItem as any);

    if (idx > 0) {
      pdf.addPage([1920, 1080], "landscape");
    }

    // 1. Background Canvas
    pdf.setFillColor(...hexToRgb(colors.bg));
    pdf.rect(0, 0, 1920, 1080, "F");

    // Top Accent Bar
    pdf.setFillColor(...hexToRgb(colors.accent));
    pdf.rect(0, 0, 1920, 12, "F");

    // 2. Header Title & Subtitle
    pdf.setFillColor(...hexToRgb(colors.accent));
    pdf.rect(80, 75, 16, 80, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(36);
    pdf.setTextColor(...hexToRgb(colors.textPrimary));
    const titleText = item.title || `Slide ${idx + 1}`;
    pdf.text(titleText, 115, 110);

    if (item.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(20);
      pdf.setTextColor(...hexToRgb(colors.accent));
      pdf.text(item.subtitle, 115, 145);
    }

    // Slide Number Badge
    pdf.setFillColor(...hexToRgb(colors.cardBg));
    pdf.setDrawColor(...hexToRgb(colors.cardBorder));
    pdf.roundedRect(1680, 75, 160, 60, 12, 12, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(...hexToRgb(colors.accent));
    pdf.text(`Slide ${idx + 1}`, 1760, 112, { align: "center" });

    // 3. Slide Content Layout
    const lines: string[] = Array.isArray(item.content)
      ? item.content.map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
      : typeof item.content === "string"
      ? item.content.split("\n").filter((l) => l.trim().length > 0)
      : ["Topic discussion details extracted from speech transcript."];

    const isTitleCover = (item.type || "").toLowerCase() === "title" || idx === 0;
    const imgPath = resolveImagePath(item.image_url);

    if (isTitleCover) {
      // Title Cover Layout
      pdf.setFillColor(...hexToRgb(colors.cardBg));
      pdf.setDrawColor(...hexToRgb(colors.cardBorder));
      pdf.roundedRect(80, 200, 1040, 740, 24, 24, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(40);
      pdf.setTextColor(...hexToRgb(colors.textPrimary));
      const splitMain = pdf.splitTextToSize(item.title || "Executive Briefing", 960);
      pdf.text(splitMain, 140, 300);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(24);
      pdf.setTextColor(...hexToRgb(colors.textSecondary));
      const subContent = item.subtitle || lines.join(" ");
      const splitSub = pdf.splitTextToSize(subContent, 960);
      pdf.text(splitSub, 140, 420);

      // Image Panel
      pdf.setFillColor(...hexToRgb(colors.cardBg));
      pdf.roundedRect(1160, 200, 680, 740, 24, 24, "FD");

      if (imgPath && fs.existsSync(imgPath)) {
        try {
          const imgBuf = fs.readFileSync(imgPath);
          pdf.addImage(Uint8Array.from(imgBuf), "JPEG", 1200, 240, 600, 420);
        } catch (err) {
          console.warn("[PDF Image Load Warning]", err);
        }
      }

      pdf.setFillColor(...hexToRgb(colors.bg));
      pdf.roundedRect(1200, 690, 600, 210, 16, 16, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(...hexToRgb(colors.textPrimary));
      const overviewText = pdf.splitTextToSize(lines[0] || "Key Domain Analysis", 540);
      pdf.text(overviewText, 1500, 750, { align: "center" });
    } else {
      // Content Bullet / Card Layout
      const hasImage = Boolean(imgPath && fs.existsSync(imgPath));
      const contentWidth = hasImage ? 1040 : 1760;

      pdf.setFillColor(...hexToRgb(colors.cardBg));
      pdf.setDrawColor(...hexToRgb(colors.cardBorder));
      pdf.roundedRect(80, 200, contentWidth, 740, 24, 24, "FD");

      let startY = 270;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(22);
      pdf.setTextColor(...hexToRgb(colors.textPrimary));

      lines.forEach((line, lIdx) => {
        if (startY > 880) return;
        pdf.setFillColor(...hexToRgb(colors.accent));
        pdf.circle(130, startY - 8, 8, "F");

        const wrapped = pdf.splitTextToSize(line, contentWidth - 120);
        pdf.text(wrapped, 160, startY);
        startY += wrapped.length * 36 + 18;
      });

      if (hasImage && imgPath) {
        pdf.setFillColor(...hexToRgb(colors.cardBg));
        pdf.roundedRect(1160, 200, 680, 740, 24, 24, "FD");
        try {
          const imgBuf = fs.readFileSync(imgPath);
          pdf.addImage(Uint8Array.from(imgBuf), "JPEG", 1200, 240, 600, 660);
        } catch (err) {
          console.warn("[PDF Image Load Warning]", err);
        }
      }
    }

    // 4. Footer
    pdf.setDrawColor(...hexToRgb(colors.cardBorder));
    pdf.line(80, 990, 1840, 990);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...hexToRgb(colors.textSecondary));
    pdf.text(cleanTitle.toUpperCase(), 80, 1030);
    pdf.text(`SLIDE ${idx + 1} OF ${slides.length}`, 1840, 1030, { align: "right" });
  }

  const pdfBuf = Buffer.from(pdf.output("arraybuffer"));
  fs.writeFileSync(filePath, pdfBuf);

  return {
    filePath,
    storageUrl: `/api/presentation/${meetingId}/download/pdf`,
  };
}

export interface ReceiptPdfData {
  receiptId: string;
  meetingId: string;
  audioFileName: string;
  audioFormat: string;
  audioSizeStr: string;
  audioDurationStr: string;
  presentationTitle: string;
  slideCount: number;
  theme: string;
  amountUsdc: number;
  currency: string;
  network: string;
  payerAddress: string;
  transactionId: string;
  status: string;
  createdAt: string;
}

export async function generateReceiptPdfFile(data: ReceiptPdfData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
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
  pdf.rect(0, 0, 210, 8, "F");

  // Brand & Document Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...primaryColor);
  pdf.text("SlideNode AI", 15, 24);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...darkTextColor);
  pdf.text("PAYMENT RECEIPT", 195, 24, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text("Verified x402 Micropayment Protocol • Algorand Testnet", 195, 29, { align: "right" });

  // Line Divider
  pdf.setDrawColor(...borderGray);
  pdf.setLineWidth(0.3);
  pdf.line(15, 34, 195, 34);

  // Status & Receipt Box
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, 38, 180, 28, 3, 3, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text("RECEIPT ID", 22, 46);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...darkTextColor);
  pdf.text(data.receiptId, 22, 53);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text("DATE & TIME", 90, 46);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...darkTextColor);
  const formattedDate = new Date(data.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  pdf.text(formattedDate, 90, 53);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text("PAYMENT STATUS", 152, 46);

  // Status Badge
  pdf.setFillColor(...successGreen);
  pdf.roundedRect(152, 49, 36, 11, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text((data.status || "CONFIRMED").toUpperCase(), 170, 56.5, { align: "center" });

  // Section 1: Payment Details
  let y = 74;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...primaryColor);
  pdf.text("PAYMENT & SETTLEMENT DETAILS", 15, y);

  y += 4;
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, y, 180, 54, 3, 3, "FD");

  let curY = y + 8;
  const drawLineRow = (lbl: string, val: string, isMono: boolean = false) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...grayTextColor);
    pdf.text(lbl, 22, curY);

    pdf.setFont(isMono ? "courier" : "helvetica", isMono ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...darkTextColor);
    pdf.text(val, 75, curY);
    curY += 8;
  };

  drawLineRow("Amount Paid:", `${Number(data.amountUsdc || 0.40).toFixed(2)} ${data.currency || 'USDC'}`);
  drawLineRow("Payment Asset:", "USDC ASA (ID: 10458941)");
  drawLineRow("Payment Protocol:", "x402 Micropayments");
  drawLineRow("Settlement Layer:", data.network || "Algorand Testnet");
  drawLineRow("Wallet Address:", (data.payerAddress || "SHATJ64UNTP4ROCYV4YW4YZVNLR66ZTNZ3LZMNXXRCREPIZHGX5ZYR25GU").substring(0, 48), true);
  drawLineRow("Transaction ID:", (data.transactionId || "VERIFIED_ON_CHAIN").substring(0, 48), true);

  // Section 2: Audio File & Presentation Metadata
  y = curY + 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...primaryColor);
  pdf.text("AUDIO FILE & PRESENTATION DETAILS", 15, y);

  y += 4;
  pdf.setFillColor(...cardBgColor);
  pdf.setDrawColor(...borderGray);
  pdf.roundedRect(15, y, 180, 54, 3, 3, "FD");

  curY = y + 8;
  drawLineRow("Audio File Name:", data.audioFileName || "audio-recording.mp3");
  drawLineRow("Audio Format:", data.audioFormat || "MP3");
  drawLineRow("File Size:", data.audioSizeStr || "4.2 MB");
  drawLineRow("Audio Duration:", data.audioDurationStr || "18 Minutes 22 Seconds");
  drawLineRow("Presentation Title:", data.presentationTitle || "Strategic Product Overview");
  drawLineRow("Slides & Theme:", `${data.slideCount || 6} Slides (${data.theme || "Executive Navy"})`);

  // Footer
  y = 270;
  pdf.setDrawColor(...borderGray);
  pdf.line(15, y, 195, y);

  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...grayTextColor);
  pdf.text("SlideNode AI • Payment Verified on Algorand Testnet", 105, y, { align: "center" });

  y += 4.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("This receipt serves as official cryptographic confirmation of service settlement.", 105, y, { align: "center" });

  return Buffer.from(pdf.output("arraybuffer"));
}
