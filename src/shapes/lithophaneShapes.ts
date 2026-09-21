import { buildLithophanePanel } from '../engine/lithophaneGeometry'
import type { Heightmap, ParamValues, ShapeDefinition } from '../engine/types'
import { colorParam, num } from './paramHelpers'

const FLAT_HEIGHTMAP: Heightmap = { data: new Float32Array([0.5, 0.5, 0.5, 0.5]), cols: 2, rows: 2 }

export const lithophanePanel: ShapeDefinition = {
  id: 'lithophane-panel',
  name: 'Photo Panel',
  description:
    'Upload a photo and it becomes a flat relief panel — thick where the image is dark, thin where it\'s light. Hang it in a window or backlight it and the picture appears in grayscale. Also works as a flat, opaque piece for layered-color printing (see the color band guide below once you upload).',
  params: [
    num('widthMm', 'Width', 40, 300, 5, 120),
    num('heightMm', 'Height', 40, 300, 5, 90),
    num('minThickness', 'Thinnest (brightest)', 0.4, 3, 0.1, 0.8),
    num('maxThickness', 'Thickest (darkest)', 1, 8, 0.1, 3.2),
    num('resolution', 'Detail', 40, 300, 10, 160, ''),
    { type: 'boolean', key: 'invert', label: 'Invert (dark = thin)', default: false },
    colorParam('#f5f0e6'),
  ],
  build: (values: ParamValues) =>
    buildLithophanePanel({
      heightmap: (values.heightmap as Heightmap | undefined) ?? FLAT_HEIGHTMAP,
      widthMm: Number(values.widthMm),
      heightMm: Number(values.heightMm),
      minThickness: Number(values.minThickness),
      maxThickness: Number(values.maxThickness),
      invert: Boolean(values.invert),
      resolution: Number(values.resolution),
    }),
}

export const lithophaneShapes: ShapeDefinition[] = [lithophanePanel]
