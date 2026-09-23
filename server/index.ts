import 'dotenv/config'
import express from 'express'
import { createImageTo3dTask, createTextTo3dTask, waitForTask } from './meshy.js'

const app = express()
// Sketch photos as base64 data URIs can be several MB.
app.use(express.json({ limit: '20mb' }))

async function finishAndSendStl(res: express.Response, kind: 'image-to-3d' | 'text-to-3d', taskId: string) {
  const finished = await waitForTask(kind, taskId)
  const stlUrl = finished.model_urls?.stl
  if (!stlUrl) {
    res.status(502).json({ error: 'Meshy finished but returned no STL download URL.' })
    return
  }

  const stlRes = await fetch(stlUrl)
  if (!stlRes.ok) {
    res.status(502).json({ error: `Failed to download generated STL (${stlRes.status}).` })
    return
  }
  const buffer = Buffer.from(await stlRes.arrayBuffer())
  res.setHeader('Content-Type', 'application/octet-stream')
  res.send(buffer)
}

app.post('/api/generate-from-image', async (req, res) => {
  try {
    const { imageDataUri } = req.body as { imageDataUri?: string }
    if (!imageDataUri || !imageDataUri.startsWith('data:image/')) {
      res.status(400).json({ error: 'imageDataUri must be a data:image/... base64 URI.' })
      return
    }
    const taskId = await createImageTo3dTask(imageDataUri)
    await finishAndSendStl(res, 'image-to-3d', taskId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error generating model.'
    console.error('[generate-from-image]', message)
    res.status(500).json({ error: message })
  }
})

app.post('/api/generate-from-text', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string }
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: 'prompt must be a non-empty string.' })
      return
    }
    if (prompt.length > 800) {
      res.status(400).json({ error: 'prompt must be 800 characters or fewer.' })
      return
    }
    const taskId = await createTextTo3dTask(prompt.trim())
    await finishAndSendStl(res, 'text-to-3d', taskId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error generating model.'
    console.error('[generate-from-text]', message)
    res.status(500).json({ error: message })
  }
})

const PORT = Number(process.env.SERVER_PORT ?? 8787)
app.listen(PORT, () => {
  console.log(`AI generation server listening on http://localhost:${PORT}`)
  if (!process.env.MESHY_API_KEY) {
    console.warn('WARNING: MESHY_API_KEY is not set — /api/generate-from-image and /api/generate-from-text will fail until it is.')
  }
})
