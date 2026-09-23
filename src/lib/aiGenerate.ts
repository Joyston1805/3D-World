function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

/** Calls the local backend (server/index.ts), which proxies to Meshy so the API key
 *  never reaches the browser. Can take anywhere from ~30s to a few minutes. */
export async function generateModelFromImage(file: File): Promise<ArrayBuffer> {
  const imageDataUri = await fileToDataUri(file)
  const res = await fetch('/api/generate-from-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUri }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${res.status}).`)
  }
  return res.arrayBuffer()
}

/** Same backend proxy, driven by a text description instead of a photo — e.g.
 *  "a small seated Buddha statue" or "a standing human figurine in a coat". */
export async function generateModelFromText(prompt: string): Promise<ArrayBuffer> {
  const res = await fetch('/api/generate-from-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${res.status}).`)
  }
  return res.arrayBuffer()
}
