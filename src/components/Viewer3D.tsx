import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getShape } from '../shapes/catalog'
import { useDesignStore } from '../store/useDesignStore'

export interface Viewer3DHandle {
  getMesh: () => THREE.Mesh | null
}

function Model({
  meshRef,
  generatedGeometry,
}: {
  meshRef: React.RefObject<THREE.Mesh | null>
  generatedGeometry: THREE.BufferGeometry | null
}) {
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)
  const values = useDesignStore((s) => s.valuesByShape[s.selectedShapeId])

  const geometry = useMemo(() => {
    if (generatedGeometry) return generatedGeometry
    const shape = getShape(selectedShapeId)
    if (!shape) return new THREE.BufferGeometry()
    return shape.build(values)
  }, [selectedShapeId, values, generatedGeometry])

  const color = generatedGeometry ? '#d6d3d1' : typeof values.color === 'string' ? values.color : '#cccccc'

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function Viewer3D({
  meshRef,
  generatedGeometry = null,
}: {
  meshRef: React.RefObject<THREE.Mesh | null>
  generatedGeometry?: THREE.BufferGeometry | null
}) {
  const controlsRef = useRef(null)
  const selectedShapeId = useDesignStore((s) => s.selectedShapeId)

  return (
    <Canvas
      shadows
      camera={{ position: [280, 220, 280], fov: 40, near: 1, far: 5000 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#111318']} />
      <hemisphereLight args={['#ffffff', '#3a3a3a', 0.6]} />
      <directionalLight
        position={[200, 300, 150]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Bounds key={generatedGeometry ? 'ai-generated' : selectedShapeId} fit clip observe margin={1.5}>
        <Model meshRef={meshRef} generatedGeometry={generatedGeometry} />
      </Bounds>
      <Grid
        args={[600, 600]}
        cellSize={10}
        cellThickness={0.5}
        sectionSize={100}
        sectionThickness={1}
        sectionColor="#4a5568"
        cellColor="#2d3340"
        fadeDistance={800}
        infiniteGrid
      />
      <OrbitControls ref={controlsRef} makeDefault />
    </Canvas>
  )
}
