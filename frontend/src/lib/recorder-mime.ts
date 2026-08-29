/**
 * Pick an audio MIME type the device's MediaRecorder actually supports.
 *
 * iOS Safari does not support audio/webm: passing it to the MediaRecorder constructor
 * throws, and a hardcoded 'audio/webm' is why practice recording was impossible on
 * iPhone. audio/mp4 is listed first because it is the one iOS accepts.
 *
 * Returns undefined when nothing matches, in which case the constructor should be called
 * with no options so the browser picks its own default.
 */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  return candidates.find(c => {
    try {
      return MediaRecorder.isTypeSupported(c)
    } catch {
      return false
    }
  })
}

/** The file extension the upload endpoint's allowlist expects for a given MIME type. */
export function extensionForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

/** True when this device can record audio at all — used to offer a skip-to-rating path. */
export function canRecordAudio(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickRecorderMime() !== undefined
  )
}
