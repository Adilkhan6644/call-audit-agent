import { apiFetch, getToken } from './client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg']
export const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg']
export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024

export const listRecordings = () => apiFetch('/recordings')

/**
 * Uses XHR instead of fetch — fetch has no upload-progress event. Plain
 * XHR is enough for a single progress callback, no library needed.
 */
export function uploadRecording(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/recordings`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const payload = xhr.responseText ? JSON.parse(xhr.responseText) : null
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload)
      else reject(new Error(payload?.error?.message || 'Upload failed'))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(form)
  })
}

/** UX nicety only — the server is the real enforcement per plan.md 3.8. */
export function validateFileLocally(file) {
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!hasAllowedExtension) return 'Unsupported file type. Use .mp3, .wav, .m4a, or .ogg.'
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return 'File exceeds the 100MB upload limit.'
  return null
}
