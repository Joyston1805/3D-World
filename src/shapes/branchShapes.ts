import { buildBranch } from '../engine/branchGeometry'
import type { ParamValues, ShapeDefinition } from '../engine/types'
import { colorParam, num } from './paramHelpers'

export const coralBranch: ShapeDefinition = {
  id: 'coral-branch',
  name: 'Coral Branch',
  description:
    'A recursive branching structure (coral / root / tree), grown from a seed with a procedural branching rule. Change the seed for an entirely different specimen. Solid (not hollow).',
  params: [
    num('seed', 'Seed (reroll for a new one)', 0, 999, 1, 13, ''),
    num('depth', 'Branch generations', 1, 5, 1, 4, ''),
    num('branchesPerNode', 'Branches per node', 1, 4, 1, 2, ''),
    num('baseLength', 'Base segment length', 15, 120, 1, 55),
    num('baseRadius', 'Base radius', 2, 25, 0.5, 8),
    num('lengthRatio', 'Length shrink per generation', 0.4, 0.95, 0.01, 0.72, ''),
    num('radiusRatio', 'Thickness shrink per generation', 0.4, 0.95, 0.01, 0.68, ''),
    num('spreadAngle', 'Spread angle', 5, 80, 1, 35, 'deg'),
    num('upwardBias', 'Upward growth bias', 0, 1, 0.05, 0.4, ''),
    num('radialSegments', 'Smoothness', 5, 20, 1, 8, ''),
    colorParam('#c97b5f'),
  ],
  build: (values: ParamValues) =>
    buildBranch({
      seed: Number(values.seed),
      depth: Number(values.depth),
      branchesPerNode: Number(values.branchesPerNode),
      baseLength: Number(values.baseLength),
      baseRadius: Number(values.baseRadius),
      lengthRatio: Number(values.lengthRatio),
      radiusRatio: Number(values.radiusRatio),
      spreadAngle: Number(values.spreadAngle),
      upwardBias: Number(values.upwardBias),
      radialSegments: Number(values.radialSegments),
    }),
}

export const branchShapes: ShapeDefinition[] = [coralBranch]
