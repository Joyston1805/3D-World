/**
 * Samples `count` evenly-spaced frames from a 360° turntable video, assuming the clip
 * covers exactly one full rotation at a constant speed — frame i is assigned azimuth
 * (i/count)*360°. Trim the clip to one clean rotation for best results; extra frames at
 * the start/end where the turn hasn't begun or has already looped will throw the angle
 * assignment off.
 */

// A 4K+ frame is far more resolution than the silhouette pipeline ever uses (it works at
// ~220px internally), so capturing at full video resolution only burns memory — a single
// 4K frame is ~33MB as a decoded RGBA canvas, and a few dozen of those is how a plain
// "record a video, upload it" phone clip can make the tab hang or crash. Downscaling here,
// not just at silhouette time, is what actually avoids holding all of that in memory at once.
const MAX_FRAME_DIMENSION = 640

// Real-world "360 video" files are sometimes an editing-format export (Apple ProRes,
// DNxHD, etc.) at hundreds of MB for a few seconds — codecs no browser can decode. Without
// a size gate, the browser just hangs trying to load/seek through one of these forever,
// which looks indistinguishable from the app having crashed. This is a blunt check (it
// can't know the codec in advance) but it catches the failure mode that actually occurs.
const MAX_VIDEO_FILE_BYTES = 300 * 1024 * 1024

const LOAD_TIMEOUT_MS = 20_000
const SEEK_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

export async function extractVideoFrames(file: File, count: number): Promise<HTMLCanvasElement[]> {
  if (file.size > MAX_VIDEO_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(0)
    const maxMb = MAX_VIDEO_FILE_BYTES / (1024 * 1024)
    throw new Error(
      `This video is ${mb}MB — over the ${maxMb}MB limit. A browser-playable format (H.264/HEVC .mp4 or .mov) shouldn't need to be this large for a short clip; if you exported from editing software, check it wasn't saved in a professional/intermediate codec like ProRes, which browsers can't decode. Try a shorter clip or a standard export setting.`,
    )
  }

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  const url = URL.createObjectURL(file)
  video.src = url

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Could not read this video file — the format may not be supported by this browser.'))
      }),
      LOAD_TIMEOUT_MS,
      'Timed out reading this video. The format may not be supported by this browser (try a standard H.264/HEVC .mp4 or .mov export).',
    )
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Could not determine the video length.')
    }

    const scale = Math.min(1, MAX_FRAME_DIMENSION / Math.max(video.videoWidth, video.videoHeight))
    const frameWidth = Math.max(1, Math.round(video.videoWidth * scale))
    const frameHeight = Math.max(1, Math.round(video.videoHeight * scale))

    const frames: HTMLCanvasElement[] = []
    for (let i = 0; i < count; i++) {
      const t = Math.min(duration - 0.001, ((i + 0.5) / count) * duration)
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.onerror = () => reject(new Error('Could not read this video file.'))
          video.currentTime = t
        }),
        SEEK_TIMEOUT_MS,
        'Timed out extracting a frame from this video — playback may have stalled on an undecodable frame.',
      )
      const canvas = document.createElement('canvas')
      canvas.width = frameWidth
      canvas.height = frameHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0, frameWidth, frameHeight)
      frames.push(canvas)
    }
    return frames
  } finally {
    URL.revokeObjectURL(url)
  }
}
