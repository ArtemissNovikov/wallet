import * as THREE from 'three'

export const BILL_W = 1.0
export const BILL_H = 0.48

// Стилизованные купюры лари: свой цвет на каждый номинал
const COLORS = {
  5: '#b5653a',
  10: '#2f8a86',
  20: '#a8445a',
  50: '#b8932c',
  100: '#6a55a6',
  200: '#3466a8',
}

// Содержимое кошелька, от дальней купюры в кармане к ближней
export const BILLS = [200, 100, 50, 20, 20, 10, 5, 5].map((value, i) => ({ id: i, value, color: COLORS[value] }))

export const TOTAL = BILLS.reduce((sum, b) => sum + b.value, 0)

function drawBill(value, color) {
  const w = 1024
  const h = Math.round((w * BILL_H) / BILL_W)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  const glow = ctx.createLinearGradient(0, 0, w, h)
  glow.addColorStop(0, 'rgba(255,255,255,0.28)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // Волнистый «защитный» узор
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'
  ctx.lineWidth = 2
  for (let k = 0; k < 16; k++) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = h / 2 + Math.sin(x / 55 + k * 0.6) * h * 0.38 * Math.cos(k * 0.35 + x / 320)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Рамка и «водяной знак»
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 6
  ctx.strokeRect(22, 22, w - 44, h - 44)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.ellipse(w * 0.36, h / 2, 105, 150, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 8

  // Номинал в левом верхнем углу: его видно, когда купюры лежат веером
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = 'bold 96px system-ui, sans-serif'
  ctx.fillText(String(value), 52, 44)

  ctx.textBaseline = 'bottom'
  ctx.font = '600 44px system-ui, sans-serif'
  ctx.fillText('ლარი · GEL', 56, h - 48)

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 210px system-ui, sans-serif'
  ctx.fillText(String(value), w - 130, h / 2 + 6)
  ctx.font = 'bold 90px system-ui, sans-serif'
  ctx.fillText('₾', w - 48, h / 2 + 30)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Один материал на номинал
export function createBillMaterials() {
  const materials = {}
  for (const { value, color } of BILLS) {
    if (materials[value]) continue
    const map = drawBill(value, color)
    materials[value] = new THREE.MeshStandardMaterial({
      map,
      // слабое свечение, чтобы купюры читались под любым углом камеры
      emissiveMap: map,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.25,
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
  }
  return materials
}
