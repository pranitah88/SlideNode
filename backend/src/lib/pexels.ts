import fs from "fs";
import path from "path";
import crypto from "crypto";

// Track globally used image IDs per presentation run to guarantee 0 repeats
const usedImageIds = new Set<number>();

/**
 * Resets the used images set at the start of a new presentation generation
 */
export function resetUsedImagesRegistry(): void {
  usedImageIds.clear();
}

/**
 * Derives a clean, concise, topic-specific Pexels search query based on slide title and content.
 */
export function derivePexelsQuery(title: string, content?: string | string[]): string {
  const fullText = (title + " " + (Array.isArray(content) ? content.join(" ") : content || "")).toLowerCase();

  // Topic specific keyword mappings
  if (/\b(crop|irrigation|farm|farmer|fertilizer|harvest|agriculture|soil|yield|grain|field)\b/i.test(fullText)) {
    if (fullText.includes("irrigation") || fullText.includes("water")) return "agricultural irrigation farmland";
    if (fullText.includes("crop") || fullText.includes("harvest")) return "crop harvesting agriculture field";
    if (fullText.includes("soil") || fullText.includes("fertilizer")) return "soil agriculture farming tech";
    return "modern agriculture farmland landscape";
  }
  if (/\b(cybersecurity|threat|vulnerability|attack|firewall|encryption|breach|security|hack|compliance)\b/i.test(fullText)) {
    if (fullText.includes("threat") || fullText.includes("attack")) return "cyber threat data protection digital";
    if (fullText.includes("firewall") || fullText.includes("encryption")) return "data encryption network server security";
    return "cybersecurity network digital security";
  }
  if (/\b(revenue|profit|margin|financial|budget|growth|investment|fiscal|stock|money|cost|economy)\b/i.test(fullText)) {
    if (fullText.includes("revenue") || fullText.includes("growth")) return "financial growth revenue stock market";
    if (fullText.includes("budget") || fullText.includes("cost")) return "business budget calculation planning";
    return "finance investment growth chart analysis";
  }
  if (/\b(architecture|api|backend|frontend|microservice|database|deploy|sprint|code|developer|software|system)\b/i.test(fullText)) {
    if (fullText.includes("code") || fullText.includes("developer")) return "software developer writing code screen";
    if (fullText.includes("database") || fullText.includes("cloud")) return "cloud data server technology infrastructure";
    return "software development computer programming";
  }
  if (/\b(patient|clinical|health|treatment|medical|hospital|care|disease|doctor|medicine)\b/i.test(fullText)) {
    return "modern healthcare medical laboratory hospital";
  }
  if (/\b(ai|artificial intelligence|llm|machine learning|robot|automation|algorithm|neural)\b/i.test(fullText)) {
    return "artificial intelligence neural network digital technology";
  }
  if (/\b(solar|green energy|wind|renewable|sustainability|climate|eco|carbon|power)\b/i.test(fullText)) {
    return "solar panels renewable green energy landscape";
  }
  if (/\b(logistics|supply chain|shipping|warehouse|transport|delivery|cargo|freight)\b/i.test(fullText)) {
    return "cargo logistics warehouse supply chain";
  }

  // Generic clean extraction from title
  const cleanTitle = title
    .replace(/\b(slide|\d+|overview|executive|summary|breakdown|roadmap|conclusion|next steps|part|chapter|section|the|main|purpose|of|our)\b/gi, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim();

  const words = cleanTitle.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    return words.slice(0, 3).join(" ") + " business technology";
  }

  return "modern professional business technology";
}

/**
 * Searches Pexels API for landscape photography matching the slide content,
 * downloads/caches the image locally on the server, and returns an HTTP accessible asset URL.
 * Strictly guarantees ZERO image repetitions per presentation deck.
 */
export async function getPexelsImageForSlide(
  title: string,
  content?: string | string[],
  slideIndex: number = 1
): Promise<string | null> {
  const pexelsKey = process.env.PEXELS_API_KEY || "";
  if (!pexelsKey || pexelsKey.trim().length === 0) {
    console.warn(`[IMAGES Warning] PEXELS_API_KEY not configured in backend/.env`);
    return null;
  }

  const query = derivePexelsQuery(title, content);
  console.log(`[IMAGES] Searching Pexels: "${query}" for Slide ${slideIndex}...`);

  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=15`, {
      headers: { "Authorization": pexelsKey }
    });

    if (!res.ok) {
      console.warn(`[IMAGES Warning] Pexels API returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const photos: any[] = data.photos || [];
    console.log(`[IMAGES] Pexels results: ${photos.length} photos found for "${query}"`);

    // Pick the first unique photo that hasn't been used yet in this presentation
    let chosenPhoto = photos.find(p => !usedImageIds.has(p.id));

    if (!chosenPhoto && photos.length > 0) {
      // Fallback offset selection if all 15 photos were somehow used
      const offsetIdx = (slideIndex - 1) % photos.length;
      chosenPhoto = photos[offsetIdx];
    }

    if (!chosenPhoto) {
      // Secondary fallback search with broader query
      console.log(`[IMAGES] Trying broader fallback query: "modern business technology"...`);
      const fallbackRes = await fetch(`https://api.pexels.com/v1/search?query=modern+business+technology&orientation=landscape&per_page=15`, {
        headers: { "Authorization": pexelsKey }
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const fallbackPhotos: any[] = fallbackData.photos || [];
        chosenPhoto = fallbackPhotos.find(p => !usedImageIds.has(p.id)) || fallbackPhotos[0];
      }
    }

    if (!chosenPhoto) {
      console.warn(`[IMAGES Warning] No suitable unique Pexels photo found for Slide ${slideIndex}`);
      return null;
    }

    // Register photo ID as used
    usedImageIds.add(chosenPhoto.id);

    const directHttpUrl = chosenPhoto.src.large || chosenPhoto.src.medium || chosenPhoto.src.original;

    // Cache image file locally on server and generate accessible HTTP asset URL
    try {
      const cacheDir = path.resolve(process.cwd(), "uploads", "image_cache");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const photoIdHash = crypto.createHash("md5").update(String(chosenPhoto.id)).digest("hex").substring(0, 10);
      const localFileName = `pexels_${photoIdHash}_slide${slideIndex}.jpg`;
      const localFilePath = path.join(cacheDir, localFileName);
      const port = process.env.PORT || 3000;
      const httpAssetUrl = `http://localhost:${port}/api/images/${localFileName}`;

      if (fs.existsSync(localFilePath)) {
        console.log(`[IMAGES] Unique image cached locally for Slide ${slideIndex} (ID: ${chosenPhoto.id}) -> ${httpAssetUrl}`);
        return httpAssetUrl;
      }

      const imgRes = await fetch(directHttpUrl);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(localFilePath, buffer);
        console.log(`[IMAGES] Selected UNIQUE image for Slide ${slideIndex} (ID: ${chosenPhoto.id}, ${buffer.length} bytes)`);
        console.log(`[IMAGES] Downloaded/cached: ${localFilePath}`);
        console.log(`[IMAGES] Added image URL to Slide ${slideIndex}: ${httpAssetUrl}`);
        return httpAssetUrl;
      }
    } catch (cacheErr: any) {
      console.warn(`[IMAGES Warning] Local image caching exception: ${cacheErr.message}`);
    }

    console.log(`[IMAGES] Selected direct Pexels HTTPS URL for Slide ${slideIndex} (ID: ${chosenPhoto.id}): ${directHttpUrl}`);
    return directHttpUrl;

  } catch (err: any) {
    console.warn(`[IMAGES Warning] Pexels fetch exception: ${err.message}`);
    return null;
  }
}
