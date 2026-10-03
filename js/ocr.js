// Optional: read a printed problem from a photo. The OCR library (about 3 MB) only
// downloads the first time someone uses the camera button, and needs internet.

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload = resolve;
      s.onerror = () => { loading = null; reject(new Error('load')); };
      document.head.append(s);
    });
  }
  return loading;
}

// Big phone photos are slow to read, so shrink them first.
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d');
    ctx.filter = 'grayscale(1) contrast(1.4)';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/png'));
  } catch {
    return file;
  }
}

export function cleanOcr(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => /\d/.test(l));
  let s = (lines.sort((a, b) => b.length - a.length)[0] || '').replace(/\s+/g, ' ');
  s = s
    .replace(/[—–]/g, '-')
    .replace(/(\d)\s*:\s*(\d)/g, '$1 ÷ $2')
    .replace(/(\d)\s*[xX*]\s*(\d)/g, s.includes('=') ? '$1x$2' : '$1 × $2')
    .replace(/(\d)([+\-=×÷])/g, '$1 $2')
    .replace(/([+\-=×÷])(\d)/g, '$1 $2');
  return s.trim();
}

export async function readPhoto(file, onProgress = () => {}) {
  onProgress('Getting the photo reader ready…');
  try {
    await loadTesseract();
  } catch {
    throw new Error("Couldn't load the photo reader. It needs internet the first time. You can type the problem instead.");
  }
  const image = await shrink(file);
  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(`Reading the problem… ${Math.round(m.progress * 100)}%`); },
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789+-=xX×÷/:().%? ' });
    const { data } = await worker.recognize(image);
    const text = cleanOcr(data.text || '');
    if (!text) throw new Error("I couldn't find a math problem in that photo. Try a closer, brighter photo of one problem, or type it.");
    return text;
  } finally {
    worker.terminate();
  }
}
