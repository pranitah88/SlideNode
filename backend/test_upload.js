import fs from 'fs';

async function uploadFile() {
  const fileBuffer = fs.readFileSync('test_125s.wav');
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, 'test_125s.wav');

  try {
    const res = await fetch('http://localhost:3000/api/meetings/upload', {
      method: 'POST',
      body: formData,
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

uploadFile();
