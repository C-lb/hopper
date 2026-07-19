'use client'

// A parametric white humanoid. This is GENERATED geometry (a lathed torso plus
// capsule limbs) that scales and morphs to the body inputs, not a real scan.
// Rendered client-only (three.js touches window) via next/dynamic ssr:false.

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

export interface BodyDims {
  height_cm: number
  chest_cm: number
  shoulder_cm: number
  waist_cm: number
  hips_cm: number
  inseam_cm: number
}

const WHITE = '#f4f4f5'

// circumference (cm) -> radius in scene units (metres). Falls back to a sane
// default when a measurement is missing so the figure never collapses.
function circRadius(circCm: number, fallbackCm: number): number {
  const c = circCm > 0 ? circCm : fallbackCm
  return c / (2 * Math.PI) / 100
}

function Figure({ dims }: { dims: BodyDims }) {
  const H = (dims.height_cm > 0 ? dims.height_cm : 175) / 100 // total height, metres

  const hipsR = circRadius(dims.hips_cm, 96)
  const waistR = circRadius(dims.waist_cm, 82)
  const chestR = circRadius(dims.chest_cm, 98)
  const shoulderHalf = (dims.shoulder_cm > 0 ? dims.shoulder_cm : 46) / 100 / 2

  const legLen = (dims.inseam_cm > 0 ? dims.inseam_cm : dims.height_cm * 0.46 || 80) / 100
  const torsoH = 0.32 * H
  const neckH = 0.05 * H
  const headR = 0.075 * H

  const hipY = legLen
  const shoulderY = hipY + torsoH
  const neckTopY = shoulderY + neckH
  const headCenterY = neckTopY + headR
  const totalH = headCenterY + headR
  const centerOffset = -totalH / 2 // recentre so the figure sits about the origin

  // Lathed torso: a smooth silhouette from pelvis -> waist (narrow) -> chest ->
  // neck base. Flattened front-to-back afterwards so it reads as a torso, not a jar.
  const torsoGeom = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.001, hipY - 0.01),
      new THREE.Vector2(hipsR * 0.62, hipY),
      new THREE.Vector2(hipsR, hipY + 0.04 * H),
      new THREE.Vector2(waistR, hipY + 0.14 * H),
      new THREE.Vector2(chestR, shoulderY - 0.07 * H),
      new THREE.Vector2(chestR * 0.66, shoulderY - 0.015 * H),
      new THREE.Vector2(0.055 * H, shoulderY),
      new THREE.Vector2(0.001, shoulderY + 0.005),
    ]
    return new THREE.LatheGeometry(pts, 28)
  }, [hipsR, waistR, chestR, hipY, shoulderY, H])

  const armLen = 0.44 * H
  const armR = 0.045 * H
  const legR = 0.06 * H

  return (
    <group position={[0, centerOffset, 0]}>
      {/* Head */}
      <mesh position={[0, headCenterY, 0]} castShadow>
        <sphereGeometry args={[headR, 24, 20]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, shoulderY + neckH / 2, 0]}>
        <cylinderGeometry args={[0.04 * H, 0.05 * H, neckH, 16]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Torso (lathed, flattened on Z) */}
      <mesh geometry={torsoGeom} scale={[1, 1, 0.6]}>
        <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
      </mesh>

      {/* Shoulder caps */}
      {[-1, 1].map((s) => (
        <mesh key={`sh${s}`} position={[s * shoulderHalf, shoulderY - 0.02 * H, 0]}>
          <sphereGeometry args={[0.06 * H, 16, 14]} />
          <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
        </mesh>
      ))}

      {/* Arms */}
      {[-1, 1].map((s) => (
        <mesh
          key={`arm${s}`}
          position={[s * (shoulderHalf + 0.01), shoulderY - armLen / 2 - 0.02 * H, 0]}
          rotation={[0, 0, s * 0.08]}
        >
          <capsuleGeometry args={[armR, armLen, 8, 16]} />
          <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
        </mesh>
      ))}

      {/* Legs */}
      {[-1, 1].map((s) => (
        <mesh key={`leg${s}`} position={[s * hipsR * 0.5, legLen / 2, 0]}>
          <capsuleGeometry args={[legR, legLen - legR, 8, 16]} />
          <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
        </mesh>
      ))}

      {/* Feet */}
      {[-1, 1].map((s) => (
        <mesh key={`foot${s}`} position={[s * hipsR * 0.5, 0.02, 0.05]}>
          <boxGeometry args={[legR * 1.6, 0.04, 0.16]} />
          <meshStandardMaterial color={WHITE} roughness={0.6} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

export default function BodyAvatar({
  dims,
  reducedMotion = false,
}: {
  dims: BodyDims
  reducedMotion?: boolean
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.1], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />
      <Figure dims={dims} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.8}
        maxDistance={5}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.9}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
