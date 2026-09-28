/**
 * Samples `count` evenly-spaced frames from a 360° turntable video, assuming the clip
 * covers exactly one full rotation at a constant speed — frame i is assigned azimuth
 * (i/count)*360°. Trim the clip to one clean rotation for best results; extra frames at
 * the start/end where the turn hasn't begun or has already looped will throw the angle
 * assignment off.
 */
export async function extractVideoFrames(file: File, count: number): Promise<HTMLCanvasElement[]> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  const url = URL.createObjectURL(file)
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not read this video file.'))
    })
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Could not determine the video length.')
    }

    const frames: HTMLCanvasElement[] = []
    for (let i = 0; i < count; i++) {
      const t = Math.min(duration - 0.001, ((i + 0.5) / count) * duration)
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        video.onerror = () => reject(new Error('Could not read this video file.'))
        video.currentTime = t
      })
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      frames.push(canvas)
    }
    return frames
  } finally {
    URL.revokeObjectURL(url)
  }
}
