import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, TrackballControls } from '@react-three/drei'
import Wallet from './Wallet.jsx'
import Bills from './Bills.jsx'
import { TOTAL } from './money.js'

const HINTS = {
  closed: 'Клик — открыть · тяни, чтобы вращать · колесо или щипок для зума',
  open: 'Клик по деньгам — достать · по кошельку — закрыть',
  hand: 'Нажми на кошелёк в углу, чтобы убрать деньги',
}

export default function App() {
  const [open, setOpen] = useState(false)
  const [inHand, setInHand] = useState(false)
  // Шкала перехода 0..1, меняется каждый кадр, поэтому не в state
  const anim = useRef({ value: 0 })
  const anchors = useRef([])

  // Клик по купюрам или их карману. Возвращает true, если клик обработан.
  const onMoneyClick = () => {
    if (inHand || anim.current.value > 0) return true
    if (!open) setOpen(true)
    else setInHand(true)
    return true
  }

  const hint = inHand ? HINTS.hand : open ? HINTS.open : HINTS.closed

  return (
    <>
      <Canvas camera={{ position: [0, 0, 3], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />

        {/* Студийное освещение без внешних HDR-файлов */}
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2} position={[0, 3, 2]} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={1} position={[-4, 0, 1]} scale={[2, 6, 1]} />
          <Lightformer form="rect" intensity={1} position={[4, 0, -1]} scale={[2, 6, 1]} />
        </Environment>

        {/* Порядок важен: кошелёк обновляет шкалу перехода раньше купюр */}
        <Wallet
          open={open}
          inHand={inHand}
          anim={anim}
          anchors={anchors}
          onToggle={() => setOpen((v) => !v)}
          onPutBack={() => setInHand(false)}
          onMoneyClick={onMoneyClick}
        />
        <Bills anim={anim} anchors={anchors} onMoneyClick={onMoneyClick} />

        {/* Свободное вращение по всем осям; в режиме «в руке» камера замирает */}
        <TrackballControls enabled={!inHand} rotateSpeed={3} noPan minDistance={1.5} maxDistance={6} />
      </Canvas>

      <div className={`total${inHand ? ' visible' : ''}`}>
        <div className="total-label">В руке</div>
        <div className="total-sum">{TOTAL} ₾</div>
      </div>
      <div className="hint">{hint}</div>
    </>
  )
}
