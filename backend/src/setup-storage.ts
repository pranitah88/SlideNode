import "dotenv/config";
import { supabase } from "./lib/supabase.js";

async function setupStorage() {
  console.log("🔄 Setting up Supabase Storage...\n");

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("❌ Failed to list buckets:", listError.message);
    process.exit(1);
  }

  const exists = buckets?.some((b) => b.name === "audio-files");

  const bucketOptions = {
    public: false,
    fileSizeLimit: 52428800, // 50 MB (Supabase free tier limit)
    allowedMimeTypes: [
      "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
      "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/x-aac",
      "audio/webm", "audio/ogg", "audio/vorbis", "audio/flac", "video/mp4", "video/webm",
      "application/octet-stream"
    ]
  };

  if (exists) {
    const { error: updateErr } = await supabase.storage.updateBucket("audio-files", bucketOptions);
    if (updateErr) {
      console.warn("⚠️ Failed to update bucket options:", updateErr.message);
    } else {
      console.log("✅ Bucket 'audio-files' updated to 100 MB limit");
    }
  } else {
    const { error } = await supabase.storage.createBucket("audio-files", bucketOptions);

    if (error) {
      console.error("❌ Failed to create bucket:", error.message);
      process.exit(1);
    }

    console.log("✅ Bucket 'audio-files' created with 100 MB limit");
  }
}

setupStorage();
