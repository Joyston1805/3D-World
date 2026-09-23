const MESHY_BASE_URL = 'https://api.meshy.ai'

export interface MeshyTaskStatus {
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'
  progress: number
  model_urls?: Record<string, string>
  task_error?: { message?: string }
}

function requireApiKey(): string {
  const key = process.env.MESHY_API_KEY
  if (!key) {
    throw new Error(
      'MESHY_API_KEY is not set. Copy server/.env.example to server/.env (or project-root .env) and add your key from meshy.ai.',
    )
  }
  return key
}

export async function createImageTo3dTask(imageDataUri: string): Promise<string> {
  const apiKey = requireApiKey()
  const res = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageDataUri,
      ai_model: 'latest',
      should_texture: false,
      should_remesh: true,
      target_formats: ['stl'],
      auto_size: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meshy image-to-3d create task failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as { result: string }
  return json.result
}

/**
 * Text to 3D is a two-stage API (preview = geometry only, refine = adds texture), but
 * for 3D printing we only need geometry, so this only ever runs the preview stage and
 * requests STL directly — cheaper and skips texturing entirely.
 */
export async function createTextTo3dTask(prompt: string): Promise<string> {
  const apiKey = requireApiKey()
  const res = await fetch(`${MESHY_BASE_URL}/openapi/v2/text-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'preview',
      prompt,
      ai_model: 'latest',
      should_remesh: true,
      target_formats: ['stl'],
      auto_size: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meshy text-to-3d create task failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as { result: string }
  return json.result
}

export type MeshyTaskKind = 'image-to-3d' | 'text-to-3d'

export async function getTaskStatus(kind: MeshyTaskKind, taskId: string): Promise<MeshyTaskStatus> {
  const apiKey = requireApiKey()
  const path = kind === 'image-to-3d' ? `openapi/v1/image-to-3d/${taskId}` : `openapi/v2/text-to-3d/${taskId}`
  const res = await fetch(`${MESHY_BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meshy task status check failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MeshyTaskStatus
}

/** Polls until the task reaches a terminal state, or throws after maxWaitMs. */
export async function waitForTask(
  kind: MeshyTaskKind,
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
): Promise<MeshyTaskStatus> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const status = await getTaskStatus(kind, taskId)
    if (status.status === 'SUCCEEDED') return status
    if (status.status === 'FAILED' || status.status === 'CANCELED') {
      throw new Error(status.task_error?.message ?? `Meshy task ended with status ${status.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }
  throw new Error('Timed out waiting for Meshy to finish generating the model.')
}
