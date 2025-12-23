import { Suspense, useEffect, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'

const MODEL_PATH = '/models/honda-shadow/scene.gltf'

function Model() {
  const { scene } = useGLTF(MODEL_PATH)

  // シーンからワイヤーフレームを生成
  const wireframeGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = []

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        // EdgesGeometryでポリゴンのエッジのみ抽出
        const edges = new THREE.EdgesGeometry(child.geometry, 18)
        geometries.push(edges)
      }
    })

    return geometries
  }, [scene])

  return (
    <Center>
      {/* X軸で-90度回転して横向きに */}
      <group scale={100} rotation={[-Math.PI / 2, 0, 0]}>
        {wireframeGeometries.map((geometry, index) => (
          <lineSegments key={index} geometry={geometry}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </lineSegments>
        ))}
      </group>
    </Center>
  )
}

export default function MotorcycleModel() {
  // クライアントサイドのみでレンダリング
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // プリロード
    useGLTF.preload(MODEL_PATH)
  }, [])

  if (!mounted) {
    return <div className="motorcycle-model" />
  }

  return (
    <div className="motorcycle-model">
      <Canvas
        camera={{ position: [120, 60, 180], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Model />
        </Suspense>
      </Canvas>
    </div>
  )
}
