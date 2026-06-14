import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(join(__dirname, 'public')))

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'ru,en;q=0.9',
}

// Парсит цвета с сайта без AI
app.post('/api/fetch-site', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL обязателен' })

  try {
    const base = new URL(url)

    // Загружаем HTML
    const htmlRes = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
    if (!htmlRes.ok) throw new Error(`Сайт вернул ${htmlRes.status}`)
    const html = await htmlRes.text()

    // Собираем CSS: встроенные <style> + внешние <link>
    let cssText = ''

    // Встроенные стили
    const styleTags = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    cssText += styleTags.map(m => m[1]).join('\n')

    // Внешние CSS файлы (берём первые 5)
    const linkMatches = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)]
    const cssUrls = linkMatches
      .map(m => {
        try { return new URL(m[1], base).href } catch { return null }
      })
      .filter(Boolean)
      .slice(0, 5)

    await Promise.all(cssUrls.map(async cssUrl => {
      try {
        const r = await fetch(cssUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
        if (r.ok) cssText += '\n' + await r.text()
      } catch { /* пропускаем недоступные */ }
    }))

    const colors = extractColors(html, cssText)
    res.json(colors)

  } catch (err) {
    console.error('Fetch site error:', err.message)
    res.status(500).json({ error: `Не удалось загрузить сайт: ${err.message}` })
  }
})

function extractColors(html, css) {
  // 1. theme-color meta — самый надёжный источник
  const themeMeta = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})/i)
    || html.match(/<meta[^>]+content=["'](#[0-9a-fA-F]{3,8})["'][^>]+name=["']theme-color["']/i)
  const themeColor = themeMeta ? normalizeHex(themeMeta[1]) : null

  // 2. CSS custom properties в :root
  const rootBlock = css.match(/:root\s*\{([^}]+)\}/s)?.[1] || ''
  const cssVars = {}
  for (const m of rootBlock.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    cssVars[m[1].toLowerCase()] = normalizeHex(m[2])
  }

  const findVar = (...keys) => {
    for (const k of keys) {
      for (const [name, val] of Object.entries(cssVars)) {
        if (name.includes(k)) return val
      }
    }
    return null
  }

  // 3. Частые ненейтральные цвета в CSS
  const hexCounts = {}
  for (const m of css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    const hex = normalizeHex('#' + m[1])
    if (!isNeutral(hex)) hexCounts[hex] = (hexCounts[hex] || 0) + 1
  }
  const topColors = Object.entries(hexCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)

  // 4. Цвет фона body
  const bodyBg = css.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i)
  const bgColor = bodyBg ? normalizeHex(bodyBg[1]) : '#ffffff'

  const primary = themeColor
    || findVar('primary', 'brand', 'main', 'color-main')
    || topColors[0]
    || '#1055cc'

  const accent = findVar('accent', 'highlight', 'secondary', 'button')
    || topColors.find(c => c !== primary)
    || primary

  return {
    primaryColor: primary,
    accentColor:  accent,
    bgColor:      bgColor,
    borderColor:  primary,
  }
}

// #abc → #aabbcc, уже 6-значные оставляем
function normalizeHex(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) return '#' + h.split('').map(c => c + c).join('')
  if (h.length === 6) return '#' + h
  if (h.length === 8) return '#' + h.slice(0, 6) // убираем альфа
  return hex
}

// Пропускаем белый, чёрный, серые
function isNeutral(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max
  return saturation < 0.15 // серые и нейтральные
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`\n✦ Banner Generator → http://localhost:${PORT}\n`)
})
