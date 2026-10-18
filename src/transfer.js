// Общая шкала анимации «деньги в руку»: 0 — всё в кошельке, 1 — веер в руке.
// Первая часть шкалы — полёт купюр, вторая — кошелёк уезжает в угол.
export const TRANSFER_TIME = 1.8 // секунд на полный переход
export const BILLS_PHASE = [0, 0.6]
export const WALLET_PHASE = [0.5, 1]
export const WALLET_CLOSE_AT = 0.55 // после этой точки кошелёк закрывается

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Прогресс внутри отрезка шкалы, 0..1
export const phase = (g, [from, to]) => clamp01((g - from) / (to - from))

export const moveTowards = (value, target, step) =>
  value < target ? Math.min(target, value + step) : Math.max(target, value - step)
