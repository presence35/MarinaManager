// Client-side image normalisation for uploads.
// Converts any decodable image (incl. HEIC where the browser can) to a
// JPEG capped at MAX_EDGE on the long side — small enough to store and to
// feed to a vision model, which downsamples beyond ~1568px anyway.

const MAX_EDGE = 2048
const QUALITY = 0.85

function loadViaImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }) } catch {}
  }
  try { return await loadViaImage(blob) } catch { return null }
}

// Returns an ImageBitmap/HTMLImageElement, or null if the format can't be decoded.
async function decodeAny(blob) {
  const direct = await decode(blob)
  if (direct) return direct
  // Likely HEIC/HEIF: convert once, then decode. Loaded lazily so the WASM
  // chunk is only fetched when such a file actually arrives.
  try {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob, toType: 'image/jpeg', quality: QUALITY })
    return await decode(Array.isArray(converted) ? converted[0] : converted)
  } catch { return null }
}

/**
 * Compress a user-selected image file to JPEG (long edge <= 2048, q0.85).
 * Falls back to the original file if it cannot be decoded, so an upload is
 * never silently dropped.
 */
export async function compressImage(file) {
  if (!file) return file
  const src = await decodeAny(file)
  if (!src) return file

  const w = src.width || src.naturalWidth || 0
  const h = src.height || src.naturalHeight || 0
  if (!w || !h) return file

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.drawImage(src, 0, 0, cw, ch)
  if (typeof src.close === 'function') src.close()

  const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!out) return file

  const name = `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`
  return new File([out], name, { type: 'image/jpeg' })
}
