'use client'

// A parametric white foot. GENERATED geometry (ellipsoids for forefoot, midfoot
// and heel plus a toe box), scaled/morphed to the per-foot inputs. Not a scan.
// Rendered client-only via next/dynamic ssr:false.

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export interface FootDims {
  foot_length_mm: number
  foot_breadth_mm: number
  ball_girth_mm: number
  heel_breadth_mm: number
  arch_height_mm: number
  instep_height_mm: number
}

const WHITE = '#f4f4f5'

function Foot({ dims, side }: { dims: FootDims; side: 'left' | 'right' }) {
  // Convert mm to scene units (metres), with fallbacks so nothing collapses.
  const len = (dims.foot_length_mm > 0 ? dims.foot_length_mm : 270) / 1000
  const breadth = (dims.foot_breadth_mm > 0 ? dims.foot_breadth_mm : 100) / 1000
  const heelW = (dims.heel_breadth_mm > 0 ? dims.heel_breadth_mm : 65) / 1000
  const ball = (dims.ball_girth_mm > 0 ? dims.ball_girth_mm : 245) / 1000
  const instep = (dims.instep_height_mm > 0 ? dims.instep_height_mm : 70) / 1000
  const arch = (dims.arch_height_mm > 0 ? dims.arch_height_mm : 25) / 1000

  // The forefoot height tracks ball girth; midfoot height tracks instep; the arch
  // input lifts the midfoot off the ground.
  const foreH = ball / Math.PI / 2 + 0.012
  const midH = instep * 0.9
  const halfLen = len / 2

  // Mirror across X for the left foot so the big toe sits on the correct side.
  const mirror = side === 'left' ? -1 : 1

  return (
    <group scale={[mirror, 1, 1]} position={[0, 0, 0]} rotation={[0, 0, 0]}>
      {/* Forefoot / ball region */}
      <mesh position={[0, foreH, halfLen * 0.45]} scale={[breadth, foreH * 2, len * 0.42]}>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Midfoot / instep, lifted by the arch height */}
      <mesh position={[0, midH * 0.6 + arch * 0.5, 0]} scale={[breadth * 0.82, midH * 1.6, len * 0.34]}>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Heel */}
      <mesh position={[0, foreH * 1.05, -halfLen * 0.62]} scale={[heelW, foreH * 2.1, len * 0.3]}>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Toe cap */}
      <mesh position={[0, foreH * 0.7, halfLen * 0.9]} scale={[breadth * 0.85, foreH * 1.2, len * 0.14]}>
        <sphereGeometry args={[0.5, 20, 14]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Sole slab so the underside reads flat */}
      <mesh position={[0, 0.006, halfLen * 0.15]} scale={[breadth * 0.96, 0.012, len * 0.92]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={WHITE} roughness={0.7} metalness={0} />
      </mesh>
    </group>
  )
}

export default function FootModel({
  dims,
  side,
  reducedMotion = false,
}: {
  dims: FootDims
  side: 'left' | 'right'
  reducedMotion?: boolean
}) {
  return (
    <Canvas
      camera={{ position: [0.28, 0.22, 0.34], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[0.4, 0.6, 0.5]} intensity={1.1} />
      <directionalLight position={[-0.4, 0.2, -0.3]} intensity={0.4} />
      <Foot dims={dims} side={side} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={0.22}
        maxDistance={0.8}
        autoRotate={!reducedMotion}
        autoRotateSpeed={1.1}
        target={[0, 0.05, 0.03]}
      />
    </Canvas>
  )
}
