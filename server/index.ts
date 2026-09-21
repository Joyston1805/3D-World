import 'dotenv/config'
import express from 'express'
import { createImageTo3dTask, waitForTask } from './meshy.js'

const app = express()
// Sketch photos as base64 data URIs can be several MB.
app.use(express.json({ limit: '20mb' }))

app.post('/api/generate-from-image', async (req, res) => {
  try {
    const { imageDataUri } = req.body as { imageDataUri?: string }
    if (!imageDataUri || !imageDataUri.startsWith('data:image/')) {
      res.status(400).json({ error: 'imageDataUri must be a data:image/... base64 URI.' })
      return
    }

    const taskId = await createImageTo3dTask(imageDataUri)
    const finished = await waitForTask(taskId)
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error generating model.'
    console.error('[generate-from-image]', message)
    res.status(500).json({ error: message })
  }
})

const PORT = Number(process.env.SERVER_PORT ?? 8787)
app.listen(PORT, () => {
  console.log(`AI generation server listening on http://localhost:${PORT}`)
  if (!process.env.MESHY_API_KEY) {
    console.warn('WARNING: MESHY_API_KEY is not set — /api/generate-from-image will fail until it is.')
  }
})
