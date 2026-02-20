import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { emissive } from 'three/tsl'

function RotatingForm() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return
    }
    meshRef.current.rotation.x += delta * 0.35
    meshRef.current.rotation.y += delta * 0.45
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshStandardMaterial color="#aaff00" metalness={0.1} roughness={0.5} emissive="#aaff00" emissiveIntensity={0.3} />
    </mesh>
  )
}

export function HeroScene() {
  return (
    <div className="scene-wrap">
      <Canvas camera={{ position: [0, 0, 4], fov: 55 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 4, 2]} intensity={1.2} />
        <RotatingForm />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  )
}