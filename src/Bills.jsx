import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { BILLS, BILL_H, BILL_W, createBillMaterials } from './money.js'
import { BILLS_PHASE, clamp01, easeInOut, phase } from './transfer.js'

const CLICK_TOLERANCE = 6

// Веер «в руке»: купюры расходятся от точки под нижним краем экрана
const FAN_DISTANCE = 2.3 // насколько далеко от камеры держим веер
const FAN_RADIUS = 1.0
const FAN_PIVOT_Y = -1.05
const FAN_STEP = THREE.MathUtils.degToRad(7) // угол между соседними купюрами
const FAN_LAYER = 0.004 // зазор по глубине, чтобы купюры не мерцали

const LIFT = 0.55 // насколько купюра выезжает вверх из кармана перед полётом
const LIFT_SHARE = 0.3 // доля полёта, которая уходит на выезд из кармана

// Полёт отдельной купюры занимает часть фазы, остальное — задержки между купюрами
const STAGGER = 0.04
const FLIGHT = 1 - ((BILLS.length - 1) * STAGGER) / (BILLS_PHASE[1] - BILLS_PHASE[0])

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const anchorPos = new THREE.Vector3()
const anchorQuat = new THREE.Quaternion()
const anchorScale = new THREE.Vector3()
const liftPos = new THREE.Vector3()
const fanPos = new THREE.Vector3()
const fanQuat = new THREE.Quaternion()

// k — порядковый номер в веере слева направо (и в каком порядке купюра достаётся)
function getFanPose(k, camera, scale) {
  const theta = ((BILLS.length - 1) / 2 - k) * FAN_STEP
  fanPos.set(
    -FAN_RADIUS * Math.sin(theta) * scale,
    (FAN_PIVOT_Y + FAN_RADIUS * Math.cos(theta)) * scale,
    -FAN_DISTANCE + k * FAN_LAYER,
  )
  camera.localToWorld(fanPos)
  fanQuat.setFromAxisAngle(Z_AXIS, theta).premultiply(camera.quaternion)
}

export default function Bills({ anim, anchors, onMoneyClick }) {
  const materials = useMemo(() => createBillMaterials(), [])
  const meshes = useRef([])

  useFrame(({ camera }) => {
    camera.updateMatrixWorld()
    const g = anim.current.value
    const local = phase(g, BILLS_PHASE)
    // на узком экране (телефон) веер поменьше
    const fanScale = Math.min(1, 0.8 * camera.aspect)

    BILLS.forEach((_, i) => {
      const mesh = meshes.current[i]
      const anchor = anchors.current[i]
      if (!mesh || !anchor) return

      anchor.updateWorldMatrix(true, false)
      anchor.matrixWorld.decompose(anchorPos, anchorQuat, anchorScale)

      // Первой достаём ближнюю купюру, она же ложится в веер крайней слева
      const k = BILLS.length - 1 - i
      const p = clamp01((local - (k * STAGGER) / (BILLS_PHASE[1] - BILLS_PHASE[0])) / FLIGHT)

      if (p === 0) {
        mesh.position.copy(anchorPos)
        mesh.quaternion.copy(anchorQuat)
        mesh.scale.copy(anchorScale)
        return
      }

      liftPos.set(0, LIFT, 0).multiply(anchorScale).applyQuaternion(anchorQuat).add(anchorPos)
      getFanPose(k, camera, fanScale)

      const lift = easeInOut(clamp01(p / LIFT_SHARE))
      const fly = easeInOut(clamp01((p - LIFT_SHARE) / (1 - LIFT_SHARE)))
      if (p < LIFT_SHARE) mesh.position.lerpVectors(anchorPos, liftPos, lift)
      else mesh.position.lerpVectors(liftPos, fanPos, fly)
      mesh.quaternion.slerpQuaternions(anchorQuat, fanQuat, fly)
      mesh.scale.setScalar(THREE.MathUtils.lerp(anchorScale.x, fanScale, fly))
    })
  })

  const onClick = (e) => {
    if (e.delta > CLICK_TOLERANCE) return
    if (onMoneyClick()) e.stopPropagation()
  }

  return BILLS.map((bill, i) => (
    <mesh key={bill.id} ref={(el) => (meshes.current[i] = el)} material={materials[bill.value]} onClick={onClick}>
      <planeGeometry args={[BILL_W, BILL_H]} />
    </mesh>
  ))
}
