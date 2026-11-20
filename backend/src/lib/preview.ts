import { cleanSlideModificationMetadata } from "./ai.js";

export interface SlideItem {
  id?: string;
  slide_number: number;
  type?: string;
  title: string;
  subtitle?: string;
  content: string | any;
  image_url?: string;
}

export interface SlidePreview {
  slide_number: number;
  title: string;
  type: string;
  preview_url: string;
  svg_content: string;
}

interface ThemePalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentGradientEnd: string;
  tagBg: string;
}

const THEME_PALETTES: Record<string, ThemePalette> = {
  executive_blue: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#e2e8f0",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    accent: "#004ac6",
    accentGradientEnd: "#2563eb",
    tagBg: "#dbe1ff",
  },
  professional: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#e2e8f0",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    accent: "#004ac6",
    accentGradientEnd: "#2563eb",
    tagBg: "#dbe1ff",
  },
  modern_indigo: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#e0e7ff",
    textPrimary: "#1e1b4b",
    textSecondary: "#4338ca",
    accent: "#4f46e5",
    accentGradientEnd: "#7c3aed",
    tagBg: "#e0e7ff",
  },
  emerald_professional: {
    bg: "#ffffff",
    cardBg: "#f0fdf4",
    cardBorder: "#bbf7d0",
    textPrimary: "#064e3b",
    textSecondary: "#166534",
    accent: "#059669",
    accentGradientEnd: "#10b981",
    tagBg: "#dcfce7",
  },
  startup: {
    bg: "#ffffff",
    cardBg: "#f0fdf4",
    cardBorder: "#bbf7d0",
    textPrimary: "#064e3b",
    textSecondary: "#166534",
    accent: "#059669",
    accentGradientEnd: "#10b981",
    tagBg: "#dcfce7",
  },
  midnight_executive: {
    bg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    accent: "#38bdf8",
    accentGradientEnd: "#818cf8",
    tagBg: "#1e1b4b",
  },
  dark: {
    bg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    accent: "#38bdf8",
    accentGradientEnd: "#818cf8",
    tagBg: "#1e1b4b",
  },
  warm_minimal: {
    bg: "#fdfbf7",
    cardBg: "#f5f2eb",
    cardBorder: "#e7e2d7",
    textPrimary: "#1c1917",
    textSecondary: "#44403c",
    accent: "#d97706",
    accentGradientEnd: "#f59e0b",
    tagBg: "#fef3c7",
  },
  tech_gradient: {
    bg: "#f8fafc",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    accent: "#0284c7",
    accentGradientEnd: "#7c3aed",
    tagBg: "#e0f2fe",
  },
  minimal_monochrome: {
    bg: "#ffffff",
    cardBg: "#fafafa",
    cardBorder: "#e5e5e5",
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    accent: "#18181b",
    accentGradientEnd: "#3f3f46",
    tagBg: "#f4f4f5",
  },
  minimal: {
    bg: "#ffffff",
    cardBg: "#fafafa",
    cardBorder: "#e5e5e5",
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    accent: "#18181b",
    accentGradientEnd: "#3f3f46",
    tagBg: "#f4f4f5",
  },
  consulting: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#cbd5e1",
    textPrimary: "#002060",
    textSecondary: "#334155",
    accent: "#c00000",
    accentGradientEnd: "#d97706",
    tagBg: "#fff1f2",
  },
  academic: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#cbd5e1",
    textPrimary: "#002060",
    textSecondary: "#334155",
    accent: "#c00000",
    accentGradientEnd: "#d97706",
    tagBg: "#fff1f2",
  },
};

export function generateSlidePreviews(
  meetingId: string,
  slides: SlideItem[],
  theme: string = "professional"
): SlidePreview[] {
  const selectedThemeKey = (theme || "executive_blue").toLowerCase().trim();
  const palette = THEME_PALETTES[selectedThemeKey] || THEME_PALETTES.executive_blue;

  return slides.map((rawSlide, idx) => {
    const slide = cleanSlideModificationMetadata(rawSlide as any);
    const slideNum = slide.slide_number || idx + 1;
    const slideType = (slide.type || inferSlideType(slide.title, idx, slides.length)).toLowerCase();
    const titleText = slide.title || `Slide ${slideNum}`;
    const subtitleText = slide.subtitle || "";
    const imageUrl = slide.image_url || getDomainImage(titleText, slideType);

    const svgInner = renderSlideContentXml(slideType, slide.content, titleText, subtitleText, palette, slideNum, imageUrl);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
      <defs>
        <linearGradient id="grad_${slideNum}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.accent}" />
          <stop offset="100%" stop-color="${palette.accentGradientEnd}" />
        </linearGradient>
        <clipPath id="clip_img_${slideNum}">
          <rect width="320" height="260" rx="12" />
        </clipPath>
        <clipPath id="clip_hero_${slideNum}">
          <rect width="360" height="420" rx="16" />
        </clipPath>
      </defs>
      
      <!-- Background Canvas -->
      <rect width="960" height="540" fill="${palette.bg}" />
      <rect x="0" y="0" width="960" height="6" fill="url(#grad_${slideNum})" />
      
      <!-- Header Section -->
      <rect x="40" y="38" width="8" height="42" fill="url(#grad_${slideNum})" rx="4" />
      
      <text fill="${palette.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold">
        ${wrapSvgText(titleText, 62, 60, 52, 1, 24)}
      </text>

      ${subtitleText ? `
      <text fill="${palette.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold">
        ${wrapSvgText(subtitleText, 62, 82, 70, 1, 16)}
      </text>` : ''}
      
      <!-- Slide Number Badge -->
      <rect x="830" y="38" width="90" height="32" fill="${palette.cardBg}" stroke="${palette.cardBorder}" stroke-width="1" rx="16" />
      <text x="875" y="59" fill="${palette.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">
        Slide ${slideNum}
      </text>

      <!-- Main Layout Body -->
      ${svgInner}

      <!-- Footer -->
      <line x1="40" y1="495" x2="920" y2="495" stroke="${palette.cardBorder}" stroke-width="1" />
      <text x="40" y="518" fill="${palette.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">
        ${escapeXml((titleText || "PRESENTATION").toUpperCase().substring(0, 50))}
      </text>
      <text x="920" y="518" fill="${palette.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" text-anchor="end">
        SLIDE ${slideNum} OF ${slides.length}
      </text>
    </svg>`;

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    return {
      slide_number: slideNum,
      title: titleText,
      type: slideType,
      preview_url: dataUrl,
      svg_content: svg,
    };
  });
}

/**
 * Dynamically resolves a high-quality stock photo URL based on topic keywords.
 */
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

  // General professional fallback
  return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
}

function inferSlideType(title: string, index: number, total: number): string {
  const t = title.toLowerCase();
  if (index === 0 || t.includes("title")) return "title";
  if (index === total - 1 || t.includes("thank") || t.includes("conclusion") || t.includes("next step")) return "thank_you";
  if (t.includes("summary") || t.includes("overview")) return "executive_summary";
  if (t.includes("insight") || t.includes("kpi") || t.includes("metric") || t.includes("performance") || t.includes("benchmark")) return "kpi_summary";
  if (t.includes("table") || t.includes("action") || t.includes("item") || t.includes("task")) return "table";
  if (t.includes("swot") || t.includes("matrix") || t.includes("risk") || t.includes("constraint")) return "swot";
  if (t.includes("roadmap") || t.includes("timeline") || t.includes("milestone") || t.includes("phase") || t.includes("schedule")) return "timeline";
  if (t.includes("architecture") || t.includes("process") || t.includes("flow") || t.includes("step")) return "process_flow";
  if (t.includes("comparison") || t.includes("versus") || t.includes("vs") || t.includes("solution")) return "comparison";
  return "bullets";
}

/**
 * Enhanced SVG text wrapping logic.
 * Enforces max lines and character bounds so text never overflows slide borders or cards.
 */
function wrapSvgText(
  text: string,
  x: number,
  y: number,
  maxCharsPerLine: number,
  maxLines: number,
  lineHeight: number,
  attributes: string = ""
): string {
  if (!text) return "";
  const words = String(text).trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (words.length > 0 && lines.length === maxLines) {
    const last = lines[lines.length - 1];
    if (last && last.length > maxCharsPerLine - 3) {
      lines[lines.length - 1] = last.substring(0, maxCharsPerLine - 3) + "...";
    }
  }

  return lines
    .map((line, idx) => `<tspan x="${x}" y="${y + idx * lineHeight}" ${attributes}>${escapeXml(line)}</tspan>`)
    .join("");
}

function renderSlideContentXml(
  type: string,
  rawContent: any,
  mainTitle: string,
  subtitle: string,
  p: ThemePalette,
  slideNum: number,
  imageUrl: string
): string {
  const lines: string[] = Array.isArray(rawContent)
    ? rawContent.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    : typeof rawContent === "string"
    ? rawContent.split("\n").map((l) => l.trim().replace(/^[•\-\*]\s*/, "")).filter((l) => l.length > 0)
    : ["Topic analysis details extracted from audio transcript."];

  // 1. TITLE SLIDE (Cover Layout)
  if (type === "title") {
    const sub = subtitle || lines[0] || mainTitle;
    return `
      <g transform="translate(40, 105)">
        <!-- Left Side Topic Box -->
        <rect width="520" height="370" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="16" />
        <rect x="40" y="45" width="140" height="26" fill="${p.accent}" rx="13" />
        <text x="110" y="62" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">
          KEY SUBJECT
        </text>
        <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold">
          ${wrapSvgText(mainTitle, 40, 125, 30, 3, 28)}
        </text>
        <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="13">
          ${wrapSvgText(sub, 40, 225, 48, 4, 20)}
        </text>

        <!-- Right Side Topic Graphic -->
        <g transform="translate(540, 0)">
          <rect width="360" height="370" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="16" />
          <rect x="0" y="0" width="360" height="8" fill="url(#grad_${slideNum})" rx="4" />
          <image href="${escapeXml(imageUrl)}" x="20" y="25" width="320" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip_img_${slideNum})" />
          <rect x="40" y="250" width="280" height="90" fill="${p.bg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">
            ${wrapSvgText(lines[0] || mainTitle, 180, 280, 34, 3, 18, 'text-anchor="middle"')}
          </text>
        </g>
      </g>`;
  }

  // 2. EXECUTIVE SUMMARY / OVERVIEW
  if (type === "executive_summary") {
    const pillars = lines.slice(0, 3);
    const cardXml = pillars.map((line, idx) => {
      const parts = line.split(":");
      const headline = parts.length > 1 ? parts[0] : `Pillar 0${idx + 1}`;
      const desc = parts.length > 1 ? parts.slice(1).join(":") : line;

      return `
        <g transform="translate(${40 + idx * 295}, 110)">
          <rect width="270" height="350" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <rect x="0" y="0" width="270" height="6" fill="${p.accent}" rx="3" />
          <circle cx="30" cy="38" r="14" fill="${p.tagBg}" />
          <text x="30" y="43" fill="${p.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">
            0${idx + 1}
          </text>
          <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold">
            ${wrapSvgText(headline, 24, 80, 22, 2, 20)}
          </text>
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
            ${wrapSvgText(desc, 24, 135, 26, 8, 18)}
          </text>
        </g>`;
    }).join("");

    return `<g>${cardXml}</g>`;
  }

  // 3. KPI SUMMARY / METRICS DASHBOARD
  if (type === "kpi_summary") {
    const kpis = lines.slice(0, 4);
    const cardsXml = kpis.map((item, idx) => {
      const parts = item.split(":");
      const kpiVal = parts.length > 1 ? parts[0] : `Indicator 0${idx + 1}`;
      const kpiLabel = parts.length > 1 ? parts.slice(1).join(":") : item;

      return `
        <g transform="translate(${40 + idx * 220}, 110)">
          <rect width="200" height="120" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <text x="20" y="45" fill="${p.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold">
            ${escapeXml(kpiVal.length > 16 ? kpiVal.substring(0, 15) + "..." : kpiVal)}
          </text>
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500">
            ${wrapSvgText(kpiLabel, 20, 72, 22, 2, 16)}
          </text>
        </g>`;
    }).join("");

    return `
      <g>
        ${cardsXml}
        <!-- Bottom Supporting Insights Box -->
        <rect x="40" y="250" width="540" height="210" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
        <text x="30" y="280" fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold">
          Quantitative Observations:
        </text>
        ${lines.slice(4, 8).map((l, i) => `
          <circle cx="35" cy="${305 + i * 36}" r="4" fill="${p.accent}" />
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
            ${wrapSvgText(l, 50, 310 + i * 36, 62, 1, 16)}
          </text>
        `).join("")}

        <!-- Right Side Domain Visual Image -->
        <g transform="translate(600, 250)">
          <rect width="320" height="210" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <image href="${escapeXml(imageUrl)}" x="10" y="10" width="300" height="190" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip_img_${slideNum})" />
        </g>
      </g>`;
  }

  // 4. PROCESS FLOW / DIAGRAM
  if (type === "process_flow") {
    const nodes = lines.slice(0, 4);
    const nodeXml = nodes.map((line, idx) => {
      const parts = line.split("|");
      const titleStr = parts[0] || `Step 0${idx + 1}`;
      const descStr = parts.length > 1 ? parts[1] : line;

      const arrowXml = idx < nodes.length - 1 ? `
        <g transform="translate(${235 + idx * 220}, 240)">
          <path d="M0,0 L20,0 M14,-5 L20,0 L14,5" stroke="${p.accent}" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>` : '';

      return `
        <g transform="translate(${40 + idx * 220}, 130)">
          <rect width="185" height="240" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <rect x="15" y="18" width="38" height="24" fill="${p.accent}" rx="12" />
          <text x="34" y="34" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">
            0${idx + 1}
          </text>
          <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold">
            ${wrapSvgText(titleStr, 15, 68, 18, 2, 18)}
          </text>
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11">
            ${wrapSvgText(descStr, 15, 118, 20, 6, 16)}
          </text>
        </g>
        ${arrowXml}`;
    }).join("");

    return `<g>${nodeXml}</g>`;
  }

  // 5. TIMELINE / ROADMAP
  if (type === "timeline") {
    const milestones = lines.slice(0, 4);
    return `
      <g transform="translate(40, 130)">
        <line x1="40" y1="110" x2="840" y2="110" stroke="${p.cardBorder}" stroke-width="4" />
        ${milestones.map((m, idx) => {
          const parts = m.split("|");
          const phase = parts[0] || `Phase ${idx + 1}`;
          const date = parts.length > 1 ? parts[1] : '';
          const detail = parts.length > 2 ? parts[2] : (parts.length > 1 ? parts[1] : m);

          const xPos = 40 + idx * 250;
          return `
            <g transform="translate(${xPos}, 0)">
              <circle cx="20" cy="110" r="14" fill="${p.accent}" />
              <circle cx="20" cy="110" r="6" fill="#ffffff" />
              
              <g transform="translate(-80, ${idx % 2 === 0 ? 0 : 140})">
                <rect width="200" height="95" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="10" />
                <text x="12" y="22" fill="${p.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">
                  ${escapeXml((phase + (date ? ' • ' + date : '')).substring(0, 24))}
                </text>
                <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11">
                  ${wrapSvgText(detail, 12, 42, 22, 3, 15)}
                </text>
              </g>
            </g>`;
        }).join("")}
      </g>`;
  }

  // 6. TABLE
  if (type === "table") {
    const rows = lines.slice(0, 5);
    return `
      <g transform="translate(40, 110)">
        <rect width="880" height="38" fill="${p.accent}" rx="8" />
        <text x="20" y="24" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">TASK / ITEM</text>
        <text x="500" y="24" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">OWNER / LEAD</text>
        <text x="710" y="24" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">STATUS</text>

        ${rows.map((rowStr, idx) => {
          const parts = rowStr.split("|");
          const task = parts[0] || rowStr;
          const owner = parts.length > 1 ? parts[1] : 'Team';
          const priority = parts.length > 2 ? parts[2] : 'Active';

          return `
            <g transform="translate(0, ${46 + idx * 62})">
              <rect width="880" height="56" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="8" />
              <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="500">
                ${wrapSvgText(task, 20, 24, 52, 2, 16)}
              </text>
              <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
                ${wrapSvgText(owner, 500, 24, 22, 2, 16)}
              </text>
              <rect x="710" y="14" width="110" height="26" fill="${p.tagBg}" rx="13" />
              <text x="765" y="31" fill="${p.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">
                ${escapeXml(priority.substring(0, 14))}
              </text>
            </g>`;
        }).join("")}
      </g>`;
  }

  // 7. SWOT / MATRIX
  if (type === "swot") {
    const categories = [
      { label: "Core Focus Areas", color: p.accent, x: 40, y: 110 },
      { label: "Critical Constraints", color: "#d97706", x: 490, y: 110 },
      { label: "Strategic Opportunities", color: "#10b981", x: 40, y: 285 },
      { label: "Risk Mitigation", color: "#ef4444", x: 490, y: 285 },
    ];

    const boxesXml = categories.map((cat, idx) => {
      const itemText = lines[idx] || `${cat.label} detail.`;
      return `
        <g transform="translate(${cat.x}, ${cat.y})">
          <rect width="430" height="160" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <rect width="430" height="6" fill="${cat.color}" rx="3" />
          <text x="20" y="35" fill="${cat.color}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold">
            ${cat.label}
          </text>
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
            ${wrapSvgText(itemText, 20, 65, 46, 4, 18)}
          </text>
        </g>`;
    }).join("");

    return `<g>${boxesXml}</g>`;
  }

  // 8. COMPARISON
  if (type === "comparison") {
    const colA = lines[0] || "Existing approach.";
    const colB = lines[1] || "Target solution.";

    return `
      <g transform="translate(40, 110)">
        <g transform="translate(0, 0)">
          <rect width="420" height="350" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
          <rect width="420" height="40" fill="${p.cardBorder}" rx="12" />
          <text x="20" y="25" fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold">
            CURRENT / BASELINE STATE
          </text>
          <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="13">
            ${wrapSvgText(colA, 20, 75, 44, 10, 20)}
          </text>
        </g>

        <g transform="translate(460, 0)">
          <rect width="420" height="350" fill="${p.cardBg}" stroke="${p.accent}" stroke-width="2" rx="12" />
          <rect width="420" height="40" fill="${p.accent}" rx="12" />
          <text x="20" y="25" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold">
            TARGET STRATEGIC SOLUTION
          </text>
          <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="13">
            ${wrapSvgText(colB, 20, 75, 44, 10, 20)}
          </text>
        </g>
      </g>`;
  }

  // 9. THANK YOU / CONCLUSION
  if (type === "thank_you") {
    return `
      <g transform="translate(40, 110)">
        <rect width="880" height="350" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="16" />
        <circle cx="440" cy="80" r="28" fill="${p.accent}" />
        <path d="M428 80 L436 88 L452 72" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        
        <text x="440" y="145" fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" text-anchor="middle">
          Summary Recommendations & Action Items
        </text>
        <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="13">
          ${wrapSvgText(lines.slice(0, 4).join(" \n• "), 60, 195, 78, 6, 22)}
        </text>
      </g>`;
  }

  // 10. DEFAULT BULLETS WITH VISUAL IMAGE CARD
  const bulletItemsXml = lines
    .slice(0, 6)
    .map(
      (line, idx) => `
      <g transform="translate(55, ${120 + idx * 56})">
        <circle cx="10" cy="14" r="4" fill="${p.accent}" />
        <text fill="${p.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="500">
          ${wrapSvgText(line, 24, 18, 54, 2, 15)}
        </text>
      </g>`
    )
    .join("");

  return `
    <g>
      <rect x="40" y="110" width="540" height="350" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
      ${bulletItemsXml}

      <g transform="translate(600, 110)">
        <rect width="320" height="240" fill="${p.cardBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
        <image href="${escapeXml(imageUrl)}" x="10" y="10" width="300" height="220" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip_img_${slideNum})" />
      </g>

      <g transform="translate(600, 365)">
        <rect width="320" height="95" fill="${p.tagBg}" stroke="${p.cardBorder}" stroke-width="1" rx="12" />
        <text x="20" y="28" fill="${p.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">
          KEY TAKEAWAY
        </text>
        <text fill="${p.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="12">
          ${wrapSvgText(lines[0] || mainTitle, 20, 50, 32, 2, 16)}
        </text>
      </g>
    </g>`;
}

function escapeXml(unsafe: string): string {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
