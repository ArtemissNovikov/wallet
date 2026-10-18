import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line, RoundedBox, useCursor } from '@react-three/drei'
import { BILLS } from './money.js'
import { TRANSFER_TIME, WALLET_CLOSE_AT, WALLET_PHASE, easeInOut, moveTowards, phase } from './transfer.js'

// Размеры в условных единицах (1 ≈ 10 см)
const W = 1.1 // ширина половинки
const H = 0.9 // высота
const P = 0.035 // толщина кожаной панели
const G = 0.07 // зазор внутри, где лежат карты
const D = G / 2 + P / 2 // смещение центра панели от оси сгиба
const STITCH_INSET = 0.04

const OPEN_ANGLE = Math.PI / 2 // на сколько поворачивается каждая половинка
const OPEN_SPEED = 5 // чем больше, тем быстрее доводка
const CLICK_TOLERANCE = 6 // px: если мышь сдвинулась сильнее, это вращение, а не клик

function useMaterials() {
  return useMemo(
    () => ({
      leather: new THREE.MeshPhysicalMaterial({
        color: '#7a4a2e',
        roughness: 0.65,
        sheen: 0.6,
        sheenColor: new THREE.Color('#c48a5c'),
        clearcoat: 0.1,
      }),
      lining: new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.8 }),
      pocket: new THREE.MeshPhysicalMaterial({
        color: '#8a5636',
        roughness: 0.6,
        sheen: 0.5,
        sheenColor: new THREE.Color('#d39b6a'),
      }),
    }),
    [],
  )
}

// Строчка-прямоугольник в плоскости z
function Stitching({ x0, x1, y0, y1, z }) {
  const points = useMemo(
    () => [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
      [x0, y0, z],
    ],
    [x0, x1, y0, y1, z],
  )

  return <Line points={points} color="#e2cba8" lineWidth={1.5} dashed dashSize={0.02} gapSize={0.012} />
}

// Половинка кошелька. Начало координат группы — точка сгиба на корешке,
// панель уходит от неё по +x. Внутренняя сторона смотрит на -side по z.
function Half({ side, materials, groupRef, children }) {
  const inner = -side * (P / 2) // z внутренней поверхности
  return (
    <group ref={groupRef} position={[0, 0, side * D]}>
      <group position={[W / 2, 0, 0]}>
        <RoundedBox args={[W, H, P]} radius={0.015} smoothness={4} material={materials.leather} />
        {/* Подкладка изнутри */}
        <mesh position={[0, 0, inner - side * 0.001]} rotation={[0, side > 0 ? Math.PI : 0, 0]} material={materials.lining}>
          <planeGeometry args={[W - 0.03, H - 0.03]} />
        </mesh>
      </group>
      <Stitching
        x0={STITCH_INSET}
        x1={W - STITCH_INSET}
        y0={-H / 2 + STITCH_INSET}
        y1={H / 2 - STITCH_INSET}
        z={side * (P / 2 + 0.001)}
      />
      {/* Содержимое половинки строится от внутренней поверхности */}
      <group position={[0, 0, inner]} scale={[1, 1, -side]}>
        {children}
      </group>
    </group>
  )
}

// Скруглённый корешок, соединяющий половинки
function Spine({ material }) {
  const geometry = useMemo(() => {
    const outer = G / 2 + P
    const inner = G / 2
    const shape = new THREE.Shape()
    shape.absarc(0, 0, outer, Math.PI / 2, (3 * Math.PI) / 2, false)
    shape.absarc(0, 0, inner, (3 * Math.PI) / 2, Math.PI / 2, true)

    const depth = H - 0.012
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      curveSegments: 32,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.004,
      bevelSegments: 3,
    })
    geo.translate(0, 0, -depth / 2)
    return geo
  }, [])

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
}

// Карман: кожаная полоска поверх содержимого, со строчкой по верхнему краю.
// Координаты локальные для содержимого половинки: z растёт внутрь кошелька.
function Pocket({ top, z, x0 = 0.05, x1 = W - 0.04, materials }) {
  const bottom = -H / 2 + 0.03
  const h = top - bottom
  return (
    <group>
      <RoundedBox
        args={[x1 - x0, h, 0.004]}
        radius={0.0015}
        position={[(x0 + x1) / 2, bottom + h / 2, z]}
        material={materials.pocket}
      />
      <Line
        points={[
          [x0 + 0.02, top - 0.018, z + 0.0025],
          [x1 - 0.02, top - 0.018, z + 0.0025],
        ]}
        color="#e2cba8"
        lineWidth={1.2}
        dashed
        dashSize={0.016}
        gapSize={0.01}
        // половинка с картами отзеркалена по z, без этого линия отсекается
        side={THREE.DoubleSide}
      />
    </group>
  )
}

const CARDS = [
  { color: '#1f4e8c', top: 0.36 },
  { color: '#c9a646', top: 0.24 },
  { color: '#222222', top: 0.12 },
]
const CARD_W = 0.856
const CARD_H = 0.54
const CARD_T = 0.006

// Карты в ступенчатых кармашках, как в обычном портмоне
function CardSlots({ materials }) {
  return CARDS.map(({ color, top }, i) => {
    const z = 0.004 + i * 0.012
    const x = W / 2 + 0.03
    return (
      <group key={color}>
        <RoundedBox args={[CARD_W, CARD_H, CARD_T]} radius={0.002} position={[x, top - CARD_H / 2, z]}>
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
        </RoundedBox>
        <Pocket top={top - 0.07} z={z + CARD_T / 2 + 0.003} materials={materials} />
      </group>
    )
  })
}

// Места купюр в отделении второй половинки. Сами купюры живут в сцене
// отдельно (Bills.jsx) и в кошельке просто следуют за этими точками.
function MoneyCompartment({ anchors, materials, onMoneyClick }) {
  const pocketZ = 0.004 + BILLS.length * 0.0015 + 0.003

  const onClick = (e) => {
    if (e.delta > CLICK_TOLERANCE) return
    if (onMoneyClick()) e.stopPropagation()
  }

  return (
    <>
      {BILLS.map((bill, i) => (
        <group
          key={bill.id}
          ref={(el) => (anchors.current[i] = el)}
          // дальние купюры выглядывают выше, чтобы было видно каждую
          position={[W / 2 + 0.02 + (i % 2 ? 0.008 : -0.008), 0.12 - i * 0.018, 0.004 + i * 0.0015]}
          rotation={[0, 0, Math.sin(i * 12.9) * 0.02]}
        />
      ))}
      <group onClick={onClick}>
        <Pocket top={0.05} z={pocketZ} materials={materials} />
      </group>
    </>
  )
}

const ZERO = new THREE.Vector3()
const NO_ROTATION = new THREE.Quaternion()
const CORNER_DISTANCE = 2
const CORNER_MARGIN = 0.3
const CORNER_SCALE = 0.22
const CORNER_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.3, 0))

const cornerPos = new THREE.Vector3()
const cornerQuat = new THREE.Quaternion()

// На узком экране иконка и отступ меньше, иначе кошелёк уезжает к центру
const cornerFit = (camera) => Math.min(1, 1.4 * camera.aspect)

// Поза мини-кошелька в левом верхнем углу экрана, привязана к камере
function getCornerPose(camera) {
  const halfH = CORNER_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const halfW = halfH * camera.aspect
  const margin = CORNER_MARGIN * cornerFit(camera)
  cornerPos.set(-halfW + margin, halfH - margin * 0.8, -CORNER_DISTANCE)
  camera.localToWorld(cornerPos)
  cornerQuat.copy(camera.quaternion).multiply(CORNER_TILT)
}

export default function Wallet({ open, inHand, anim, anchors, onToggle, onPutBack, onMoneyClick }) {
  const materials = useMaterials()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const carrier = useRef()
  const turn = useRef()
  const shift = useRef()
  const front = useRef()
  const back = useRef()
  const angle = useRef(0)

  useFrame(({ camera }, dt) => {
    // Общая шкала перехода: её же читают купюры
    const g = moveTowards(anim.current.value, inHand ? 1 : 0, dt / TRANSFER_TIME)
    anim.current.value = g

    const target = open && g < WALLET_CLOSE_AT ? OPEN_ANGLE : 0
    angle.current = THREE.MathUtils.damp(angle.current, target, OPEN_SPEED, dt)
    const a = angle.current
    const t = a / OPEN_ANGLE

    // Половинки расходятся вокруг своих точек сгиба
    front.current.rotation.y = -a
    back.current.rotation.y = a
    // Весь кошелёк доворачивается, чтобы раскрытая сторона смотрела на зрителя,
    // а центр смещается с середины закрытого кошелька на корешок
    turn.current.rotation.y = -a
    shift.current.position.x = (-W / 2) * (1 - t)

    // Уход в угол экрана и обратно
    const w = easeInOut(phase(g, WALLET_PHASE))
    if (w > 0) {
      camera.updateMatrixWorld()
      getCornerPose(camera)
    }
    carrier.current.position.lerpVectors(ZERO, cornerPos, w)
    carrier.current.quaternion.slerpQuaternions(NO_ROTATION, cornerQuat, w)
    // на узком экране (телефон) кошелёк меньше, чтобы раскрытый влезал по ширине
    const sceneScale = Math.min(1, 0.85 * camera.aspect)
    carrier.current.scale.setScalar(THREE.MathUtils.lerp(sceneScale, CORNER_SCALE * cornerFit(camera), w))
  })

  const onClick = (e) => {
    if (e.delta > CLICK_TOLERANCE) return
    e.stopPropagation()
    if (inHand) onPutBack()
    else if (anim.current.value === 0) onToggle()
  }

  return (
    <group ref={carrier}>
      <group rotation={[0.25, -0.5, 0]}>
        <group ref={turn}>
          <group
            ref={shift}
            onClick={onClick}
            onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
            onPointerOut={() => setHovered(false)}
          >
            <Half side={-1} materials={materials} groupRef={back}>
              <MoneyCompartment anchors={anchors} materials={materials} onMoneyClick={onMoneyClick} />
            </Half>
            <Half side={1} materials={materials} groupRef={front}>
              <CardSlots materials={materials} />
            </Half>
            <Spine material={materials.leather} />
          </group>
        </group>
      </group>
    </group>
  )
}
