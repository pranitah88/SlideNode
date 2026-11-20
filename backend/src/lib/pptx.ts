import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import { supabase } from "./supabase.js";
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

function getDomainImage(title: string, type: string): string {
  const t = (title + " " + type).toLowerCase();
  
  if (t.includes("crop") || t.includes("farm") || t.includes("agri") || t.includes("soil") || t.includes("irrigation") || t.includes("land") || t.includes("fertilizer") || t.includes("harvest")) {
    return "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("cyber") || t.includes("security") || t.includes("threat") || t.includes("auth") || t.includes("encryption") || t.includes("breach") || t.includes("firewall")) {
    return "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("code") || t.includes("arch") || t.includes("tech") || t.includes("software") || t.includes("system") || t.includes("api") || t.includes("data") || t.includes("cloud")) {
    return "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("finance") || t.includes("revenue") || t.includes("profit") || t.includes("kpi") || t.includes("metric") || t.includes("budget") || t.includes("fiscal") || t.includes("cost") || t.includes("margin")) {
    return "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("health") || t.includes("patient") || t.includes("medical") || t.includes("care") || t.includes("clinical") || t.includes("hospital") || t.includes("disease")) {
    return "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("logistics") || t.includes("supply") || t.includes("chain") || t.includes("transport") || t.includes("shipping") || t.includes("delivery")) {
    return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80";
  }
  if (t.includes("edu") || t.includes("school") || t.includes("learn") || t.includes("student") || t.includes("training")) {
    return "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80";
  }

  return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
}

export async function generatePptxFile(
  meetingId: string,
  meetingName: string,
  slides: SlideItem[],
  theme: string = "professional"
): Promise<{ fileName: string; storageUrl: string; filePath: string }> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const themeKey = (theme || "executive_blue").toLowerCase().trim();

  // Color Palettes
  const colorMap: Record<string, { bg: string; cardBg: string; border: string; textPrimary: string; textSecondary: string; accent: string; headerBg: string }> = {
    executive_blue: { bg: "FFFFFF", cardBg: "F8FAFC", border: "E2E8F0", textPrimary: "0F172A", textSecondary: "334155", accent: "004AC6", headerBg: "DBE1FF" },
    professional: { bg: "FFFFFF", cardBg: "F8FAFC", border: "E2E8F0", textPrimary: "0F172A", textSecondary: "334155", accent: "004AC6", headerBg: "DBE1FF" },
    modern_indigo: { bg: "FFFFFF", cardBg: "F8FAFC", border: "E0E7FF", textPrimary: "1E1B4B", textSecondary: "4338CA", accent: "4F46E5", headerBg: "E0E7FF" },
    emerald_professional: { bg: "FFFFFF", cardBg: "F0FDF4", border: "BBF7D0", textPrimary: "064E3B", textSecondary: "166534", accent: "059669", headerBg: "DCFCE7" },
    startup: { bg: "FFFFFF", cardBg: "F0FDF4", border: "BBF7D0", textPrimary: "064E3B", textSecondary: "166534", accent: "059669", headerBg: "DCFCE7" },
    midnight_executive: { bg: "0F172A", cardBg: "1E293B", border: "334155", textPrimary: "F8FAFC", textSecondary: "94A3B8", accent: "38BDF8", headerBg: "1E1B4B" },
    dark: { bg: "0F172A", cardBg: "1E293B", border: "334155", textPrimary: "F8FAFC", textSecondary: "94A3B8", accent: "38BDF8", headerBg: "1E1B4B" },
    warm_minimal: { bg: "FDFBF7", cardBg: "F5F2EB", border: "E7E2D7", textPrimary: "1C1917", textSecondary: "44403C", accent: "D97706", headerBg: "FEF3C7" },
    tech_gradient: { bg: "F8FAFC", cardBg: "FFFFFF", border: "E2E8F0", textPrimary: "0F172A", textSecondary: "334155", accent: "0284C7", headerBg: "E0F2FE" },
    minimal_monochrome: { bg: "FFFFFF", cardBg: "FAFAFA", border: "E5E5E5", textPrimary: "18181B", textSecondary: "52525B", accent: "18181B", headerBg: "F4F4F5" },
    minimal: { bg: "FFFFFF", cardBg: "FAFAFA", border: "E5E5E5", textPrimary: "18181B", textSecondary: "52525B", accent: "18181B", headerBg: "F4F4F5" },
    consulting: { bg: "FFFFFF", cardBg: "F8FAFC", border: "CBD5E1", textPrimary: "002060", textSecondary: "334155", accent: "C00000", headerBg: "FFF1F2" },
    academic: { bg: "FFFFFF", cardBg: "F8FAFC", border: "CBD5E1", textPrimary: "002060", textSecondary: "334155", accent: "C00000", headerBg: "FFF1F2" },
  };

  const colors = colorMap[themeKey] || colorMap.executive_blue;

function resolvePptxImagePath(imageUrl: string): string {
  if (!imageUrl) return "";

  // If it's an HTTP URL pointing to /api/images/filename.jpg, resolve local file path on disk
  if (imageUrl.includes("/api/images/")) {
    const filename = imageUrl.split("/api/images/").pop();
    if (filename) {
      const localPath = path.resolve(process.cwd(), "uploads", "image_cache", filename);
      if (fs.existsSync(localPath)) {
        return localPath;
      }
    }
  }

  // If it's a local file path and exists
  if (fs.existsSync(imageUrl)) {
    return imageUrl;
  }

  // If it's an http:// or https:// URL, return as is
  return imageUrl;
}

  for (let idx = 0; idx < slides.length; idx++) {
    const item = cleanSlideModificationMetadata(slides[idx] as any);
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };

    const slideType = (item.type || inferSlideType(item.title, idx, slides.length)).toLowerCase();
    const rawImageUrl = item.image_url || getDomainImage(item.title, slideType);
    const imageUrl = resolvePptxImagePath(rawImageUrl);

    // =========================================================================
    // SLIDE TYPE 1: TITLE SLIDE (Cover Layout)
    // =========================================================================
    if (slideType === "title" || idx === 0) {
      slide.addShape("rect" as any, {
        x: 0.8,
        y: 0.8,
        w: 6.8,
        h: 5.8,
        fill: { color: colors.cardBg },
        line: { color: colors.border, width: 1 },
      });

      slide.addShape("rect" as any, {
        x: 1.2,
        y: 1.3,
        w: 2.2,
        h: 0.4,
        fill: { color: colors.accent },
        line: { color: colors.accent },
      });

      slide.addText("KEY SUBJECT", {
        x: 1.2,
        y: 1.3,
        w: 2.2,
        h: 0.4,
        fontSize: 10,
        bold: true,
        color: "FFFFFF",
        align: "center",
        fontFace: "Arial",
      });

      slide.addText(item.title || meetingName || "Subject Presentation", {
        x: 1.2,
        y: 1.9,
        w: 6.0,
        h: 1.8,
        fontSize: 28,
        bold: true,
        color: colors.textPrimary,
        fontFace: "Arial",
      });

      if (item.subtitle) {
        slide.addText(item.subtitle, {
          x: 1.2,
          y: 3.8,
          w: 6.0,
          h: 1.2,
          fontSize: 14,
          color: colors.accent,
          fontFace: "Arial",
        });
      }

      try {
        slide.addImage({
          path: imageUrl,
          x: 7.8,
          y: 0.8,
          w: 4.7,
          h: 5.8,
        });
      } catch (err) {
        slide.addShape("rect" as any, {
          x: 7.8,
          y: 0.8,
          w: 4.7,
          h: 5.8,
          fill: { color: colors.accent },
        });
      }
      continue;
    }

    // =========================================================================
    // SLIDE HEADER (Standard for content slides)
    // =========================================================================
    slide.addShape("rect" as any, {
      x: 0.8,
      y: 0.45,
      w: 0.12,
      h: 0.55,
      fill: { color: colors.accent },
      line: { color: colors.accent },
    });

    slide.addText(item.title, {
      x: 1.05,
      y: 0.4,
      w: 8.5,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: colors.textPrimary,
      fontFace: "Arial",
    });

    if (item.subtitle) {
      slide.addText(item.subtitle, {
        x: 1.05,
        y: 0.95,
        w: 8.5,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: colors.accent,
        fontFace: "Arial",
      });
    }

    slide.addShape("rect" as any, {
      x: 11.2,
      y: 0.45,
      w: 1.3,
      h: 0.35,
      fill: { color: colors.cardBg },
      line: { color: colors.border, width: 1 },
    });
    slide.addText(`Slide ${idx + 1}`, {
      x: 11.2,
      y: 0.45,
      w: 1.3,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: colors.accent,
      align: "center",
      fontFace: "Arial",
    });

    // =========================================================================
    // SLIDE BODY LAYOUTS
    // =========================================================================
    const rawContentStr = typeof item.content === "string"
      ? item.content
      : Array.isArray(item.content)
      ? item.content.map(i => typeof i === "string" ? i : JSON.stringify(i)).join("\n")
      : JSON.stringify(item.content || "");

    const rawLines = rawContentStr
      .split("\n")
      .map((l) => l.trim().replace(/^[•\-\*]\s*/, ""))
      .filter((l) => l.length > 0);

    // -------------------------------------------------------------------------
    // LAYOUT 2: EXECUTIVE SUMMARY (3 Cards)
    // -------------------------------------------------------------------------
    if (slideType === "executive_summary") {
      const pillars = rawLines.slice(0, 3);
      pillars.forEach((pillarStr, pIdx) => {
        const parts = pillarStr.split(":");
        const headline = parts.length > 1 ? parts[0] : `Pillar 0${pIdx + 1}`;
        const desc = parts.length > 1 ? parts.slice(1).join(":") : pillarStr;

        const xPos = 0.8 + pIdx * 3.9;
        slide.addShape("rect" as any, {
          x: xPos,
          y: 1.45,
          w: 3.7,
          h: 4.8,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 },
        });

        slide.addShape("rect" as any, {
          x: xPos,
          y: 1.45,
          w: 3.7,
          h: 0.1,
          fill: { color: colors.accent },
        });

        slide.addText(`0${pIdx + 1}`, {
          x: xPos + 0.3,
          y: 1.8,
          w: 3.1,
          h: 0.4,
          fontSize: 16,
          bold: true,
          color: colors.accent,
          fontFace: "Arial",
        });

        slide.addText(headline.substring(0, 30), {
          x: xPos + 0.3,
          y: 2.3,
          w: 3.1,
          h: 0.6,
          fontSize: 18,
          bold: true,
          color: colors.textPrimary,
          fontFace: "Arial",
        });

        slide.addText(desc.substring(0, 160), {
          x: xPos + 0.3,
          y: 3.0,
          w: 3.1,
          h: 3.0,
          fontSize: 12,
          color: colors.textSecondary,
          fontFace: "Arial",
        });
      });

    // -------------------------------------------------------------------------
    // LAYOUT 3: KPI SUMMARY / METRICS
    // -------------------------------------------------------------------------
    } else if (slideType === "kpi_summary") {
      const kpis = rawLines.slice(0, 4);
      kpis.forEach((cardStr, cIdx) => {
        const parts = cardStr.split(":");
        const kpiVal = parts.length > 1 ? parts[0] : `0${cIdx + 1}`;
        const kpiLabel = parts.length > 1 ? parts.slice(1).join(":") : cardStr;

        const xPos = 0.8 + cIdx * 2.95;
        slide.addShape("rect" as any, {
          x: xPos,
          y: 1.45,
          w: 2.7,
          h: 1.6,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 },
        });

        slide.addText(kpiVal.substring(0, 18), {
          x: xPos + 0.2,
          y: 1.65,
          w: 2.3,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: colors.accent,
          fontFace: "Arial",
        });

        slide.addText(kpiLabel.substring(0, 36), {
          x: xPos + 0.2,
          y: 2.3,
          w: 2.3,
          h: 0.6,
          fontSize: 11,
          color: colors.textSecondary,
          fontFace: "Arial",
        });
      });

      // Bottom Insights Box
      slide.addShape("rect" as any, {
        x: 0.8,
        y: 3.25,
        w: 7.2,
        h: 3.4,
        fill: { color: colors.cardBg },
        line: { color: colors.border, width: 1 },
      });

      const takeawayLines = rawLines.slice(4, 9).map(l => ({
        text: l,
        options: { bullet: true, fontSize: 12, color: colors.textSecondary, spaceBefore: 6, fontFace: "Arial" }
      }));

      if (takeawayLines.length > 0) {
        slide.addText(takeawayLines, {
          x: 1.1,
          y: 3.45,
          w: 6.6,
          h: 3.0,
          fontFace: "Arial",
        });
      }

      try {
        slide.addImage({ path: imageUrl, x: 8.3, y: 3.25, w: 4.2, h: 3.4 });
      } catch (e) {}

    // -------------------------------------------------------------------------
    // LAYOUT 4: PROCESS FLOW
    // -------------------------------------------------------------------------
    } else if (slideType === "process_flow") {
      const nodes = rawLines.slice(0, 4);
      nodes.forEach((nodeStr, nIdx) => {
        const parts = nodeStr.split("|");
        const nodeTitle = parts[0] || `Step 0${nIdx + 1}`;
        const nodeDesc = parts.length > 1 ? parts[1] : nodeStr;

        const xPos = 0.8 + nIdx * 2.95;
        slide.addShape("rect" as any, {
          x: xPos,
          y: 1.8,
          w: 2.7,
          h: 3.8,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 },
        });

        slide.addShape("rect" as any, {
          x: xPos + 0.3,
          y: 2.1,
          w: 0.6,
          h: 0.35,
          fill: { color: colors.accent },
        });

        slide.addText(`0${nIdx + 1}`, {
          x: xPos + 0.3,
          y: 2.1,
          w: 0.6,
          h: 0.35,
          fontSize: 11,
          bold: true,
          color: "FFFFFF",
          align: "center",
          fontFace: "Arial",
        });

        slide.addText(nodeTitle.substring(0, 24), {
          x: xPos + 0.3,
          y: 2.65,
          w: 2.1,
          h: 0.7,
          fontSize: 15,
          bold: true,
          color: colors.textPrimary,
          fontFace: "Arial",
        });

        slide.addText(nodeDesc.substring(0, 110), {
          x: xPos + 0.3,
          y: 3.4,
          w: 2.1,
          h: 2.0,
          fontSize: 11,
          color: colors.textSecondary,
          fontFace: "Arial",
        });
      });

    // -------------------------------------------------------------------------
    // LAYOUT 5: TIMELINE / ROADMAP
    // -------------------------------------------------------------------------
    } else if (slideType === "timeline") {
      slide.addShape("line" as any, {
        x: 0.8,
        y: 3.5,
        w: 11.7,
        h: 0,
        line: { color: colors.accent, width: 3 }
      });

      const milestones = rawLines.slice(0, 4);
      milestones.forEach((mStr, mIdx) => {
        const parts = mStr.split("|");
        const phase = parts[0] || `Phase ${mIdx + 1}`;
        const date = parts.length > 1 ? parts[1] : '';
        const detail = parts.length > 2 ? parts[2] : (parts.length > 1 ? parts[1] : mStr);

        const xPos = 1.0 + mIdx * 3.0;
        const yCard = mIdx % 2 === 0 ? 1.5 : 3.8;

        slide.addShape("oval" as any, {
          x: xPos + 1.1,
          y: 3.35,
          w: 0.3,
          h: 0.3,
          fill: { color: colors.accent },
        });

        slide.addShape("rect" as any, {
          x: xPos,
          y: yCard,
          w: 2.5,
          h: 1.5,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 },
        });

        slide.addText(`${phase} ${date ? '• ' + date : ''}`, {
          x: xPos + 0.2,
          y: yCard + 0.15,
          w: 2.1,
          h: 0.4,
          fontSize: 12,
          bold: true,
          color: colors.accent,
          fontFace: "Arial",
        });

        slide.addText(detail.substring(0, 70), {
          x: xPos + 0.2,
          y: yCard + 0.6,
          w: 2.1,
          h: 0.8,
          fontSize: 10,
          color: colors.textSecondary,
          fontFace: "Arial",
        });
      });

    // -------------------------------------------------------------------------
    // LAYOUT 6: TABLE
    // -------------------------------------------------------------------------
    } else if (slideType === "table") {
      const tableData: any[] = [
        [
          { text: "TASK / ITEM", options: { bold: true, fill: { color: colors.accent }, color: "FFFFFF" } },
          { text: "OWNER / LEAD", options: { bold: true, fill: { color: colors.accent }, color: "FFFFFF" } },
          { text: "STATUS", options: { bold: true, fill: { color: colors.accent }, color: "FFFFFF" } }
        ]
      ];

      rawLines.slice(0, 4).forEach((rowStr) => {
        const parts = rowStr.split("|");
        const task = parts[0] || rowStr;
        const owner = parts.length > 1 ? parts[1] : 'Team';
        const priority = parts.length > 2 ? parts[2] : 'Active';

        tableData.push([
          { text: task.substring(0, 50), options: { bold: false, fill: { color: colors.cardBg }, color: colors.textPrimary } },
          { text: owner.substring(0, 25), options: { bold: false, fill: { color: colors.cardBg }, color: colors.textSecondary } },
          { text: priority.substring(0, 16), options: { bold: true, fill: { color: colors.cardBg }, color: colors.accent } }
        ]);
      });

      slide.addTable(tableData as any, {
        x: 0.8,
        y: 1.6,
        w: 11.7,
        rowH: 0.8,
        colW: [5.5, 3.2, 3.0],
        fontSize: 12,
        fontFace: "Arial",
        fill: { color: colors.cardBg },
        border: { pt: 1, color: colors.border }
      });

    // -------------------------------------------------------------------------
    // LAYOUT 7: SWOT MATRIX
    // -------------------------------------------------------------------------
    } else if (slideType === "swot") {
      const swotBoxes = [
        { label: "Core Focus", color: colors.accent, x: 0.8, y: 1.45 },
        { label: "Constraints", color: "D97706", x: 6.8, y: 1.45 },
        { label: "Opportunities", color: "10B981", x: 0.8, y: 3.95 },
        { label: "Mitigation", color: "EF4444", x: 6.8, y: 3.95 },
      ];

      swotBoxes.forEach((box, bIdx) => {
        const itemText = rawLines[bIdx] || `${box.label} point.`;
        slide.addShape("rect" as any, {
          x: box.x,
          y: box.y,
          w: 5.7,
          h: 2.3,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 },
        });

        slide.addShape("rect" as any, {
          x: box.x,
          y: box.y,
          w: 5.7,
          h: 0.1,
          fill: { color: box.color },
        });

        slide.addText(box.label, {
          x: box.x + 0.3,
          y: box.y + 0.3,
          w: 5.1,
          h: 0.4,
          fontSize: 16,
          bold: true,
          color: box.color,
          fontFace: "Arial",
        });

        slide.addText(itemText.substring(0, 120), {
          x: box.x + 0.3,
          y: box.y + 0.8,
          w: 5.1,
          h: 1.3,
          fontSize: 12,
          color: colors.textSecondary,
          fontFace: "Arial",
        });
      });

    // -------------------------------------------------------------------------
    // LAYOUT 8: COMPARISON
    // -------------------------------------------------------------------------
    } else if (slideType === "comparison") {
      const colA = rawLines[0] || "Baseline state.";
      const colB = rawLines[1] || "Target strategic solution.";

      // Card A
      slide.addShape("rect" as any, {
        x: 0.8,
        y: 1.45,
        w: 5.6,
        h: 4.8,
        fill: { color: colors.cardBg },
        line: { color: colors.border, width: 1 },
      });
      slide.addText("CURRENT / BASELINE STATE", {
        x: 1.1,
        y: 1.75,
        w: 5.0,
        h: 0.5,
        fontSize: 14,
        bold: true,
        color: colors.textSecondary,
        fontFace: "Arial",
      });
      slide.addText(colA.substring(0, 220), {
        x: 1.1,
        y: 2.35,
        w: 5.0,
        h: 3.6,
        fontSize: 12,
        color: colors.textSecondary,
        fontFace: "Arial",
      });

      // Card B
      slide.addShape("rect" as any, {
        x: 6.9,
        y: 1.45,
        w: 5.6,
        h: 4.8,
        fill: { color: colors.cardBg },
        line: { color: colors.accent, width: 2 },
      });
      slide.addText("TARGET STRATEGIC SOLUTION", {
        x: 7.2,
        y: 1.75,
        w: 5.0,
        h: 0.5,
        fontSize: 14,
        bold: true,
        color: colors.accent,
        fontFace: "Arial",
      });
      slide.addText(colB.substring(0, 220), {
        x: 7.2,
        y: 2.35,
        w: 5.0,
        h: 3.6,
        fontSize: 12,
        color: colors.textPrimary,
        fontFace: "Arial",
      });

    // -------------------------------------------------------------------------
    // LAYOUT 9: STANDARD BULLETS WITH SIDE IMAGE
    // -------------------------------------------------------------------------
    } else {
      slide.addShape("rect" as any, {
        x: 0.8,
        y: 1.45,
        w: 7.2,
        h: 5.1,
        fill: { color: colors.cardBg },
        line: { color: colors.border, width: 1 },
      });

      const formattedLines = rawLines.slice(0, 6).map((line) => ({
        text: line,
        options: {
          bullet: true,
          fontSize: 13,
          color: colors.textSecondary,
          fontFace: "Arial",
          spaceBefore: 8,
          breakLine: true,
        },
      }));

      if (formattedLines.length > 0) {
        slide.addText(formattedLines, {
          x: 1.1,
          y: 1.75,
          w: 6.6,
          h: 4.5,
          fontFace: "Arial",
        });
      }

      try {
        slide.addImage({
          path: imageUrl,
          x: 8.3,
          y: 1.45,
          w: 4.2,
          h: 3.5,
        });
      } catch (err) {}

      slide.addShape("rect" as any, {
        x: 8.3,
        y: 5.1,
        w: 4.2,
        h: 1.45,
        fill: { color: colors.headerBg },
        line: { color: colors.accent, width: 1 },
      });

      slide.addText("KEY TAKEAWAY", {
        x: 8.5,
        y: 5.25,
        w: 3.8,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: colors.accent,
        fontFace: "Arial",
      });

      slide.addText(rawLines[0]?.substring(0, 80) || item.title, {
        x: 8.5,
        y: 5.55,
        w: 3.8,
        h: 0.8,
        fontSize: 11,
        color: colors.textPrimary,
        fontFace: "Arial",
      });
    }

    // Standard Slide Footer
    slide.addText(`Slide ${idx + 1} of ${slides.length} • ${meetingName || item.title}`, {
      x: 0.8,
      y: 6.75,
      w: 11.7,
      h: 0.3,
      fontSize: 10,
      color: colors.textSecondary,
      align: "right",
      fontFace: "Arial",
    });
  }

  // Save locally and upload to Supabase Storage
  const tempDir = path.resolve(process.cwd(), "dist", "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = `presentation_${meetingId}_${Date.now()}.pptx`;
  const localFilePath = path.join(tempDir, fileName);

  await pptx.writeFile({ fileName: localFilePath });
  const fileBuffer = fs.readFileSync(localFilePath);

  const storagePath = `pptx/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("audio-files")
    .upload(storagePath, fileBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      upsert: true,
    });

  let storageUrl = `/api/presentation/${meetingId}/download/pptx`;
  if (!uploadError) {
    const { data: signedData } = await supabase.storage
      .from("audio-files")
      .createSignedUrl(storagePath, 86400 * 30);
    if (signedData?.signedUrl) {
      storageUrl = signedData.signedUrl;
    }
  }

  return { fileName, storageUrl, filePath: localFilePath };
}

function inferSlideType(title: string, index: number, total: number): string {
  const t = title.toLowerCase();
  if (index === 0 || t.includes("title")) return "title";
  if (index === total - 1 || t.includes("thank") || t.includes("conclusion")) return "thank_you";
  if (t.includes("summary") || t.includes("overview")) return "executive_summary";
  if (t.includes("insight") || t.includes("kpi") || t.includes("metric")) return "kpi_summary";
  if (t.includes("action") || t.includes("item") || t.includes("table")) return "table";
  if (t.includes("risk") || t.includes("challenge") || t.includes("swot")) return "swot";
  if (t.includes("roadmap") || t.includes("timeline") || t.includes("schedule")) return "timeline";
  if (t.includes("process") || t.includes("flow") || t.includes("step")) return "process_flow";
  return "bullets";
}
