// ─── Шаблоны ─────────────────────────────────────────────────────────────────

// Анонсные С контентом (заголовок + описание)
const ANNOUNCE = [
  { id: 'nodate',    label: 'Без даты',    status: null,            showDate: false },
  { id: 'withdate',  label: 'С датой',     status: null,            showDate: true  },
  { id: 'tomorrow',  label: 'Уже завтра',  status: 'УЖЕ ЗАВТРА',   showDate: false },
  { id: 'today',     label: 'Уже сегодня', status: 'УЖЕ СЕГОДНЯ',  showDate: false },
]

// Анонсные БЕЗ контента — только плашка + фото
const ANNOUNCE_SIMPLE = [
  { id: 'nachinayem', label: 'Начинаем',   status: 'НАЧИНАЕМ'    },
  { id: 'live',       label: 'Мы в эфире', status: 'МЫ В ЭФИРЕ'  },
]

// Статусные — плашка(и) + иконка
const STATUS = [
  { id: '15min',   label: '15 минут',      lines: ['НАЧИНАЕМ', 'ЧЕРЕЗ 15 МИНУТ'] },
  { id: '5min',    label: '5 минут',       lines: ['НАЧИНАЕМ', 'ЧЕРЕЗ 5 МИНУТ']  },
  { id: 'hour',    label: 'Час до старта', lines: ['ЧАС ДО СТАРТА']              },
  { id: 'repeat',  label: 'Повтор',        lines: ['ПОВТОР']                     },
  { id: 'bonus',   label: 'Бонус',         lines: ['БОНУС ДЛЯ ВАС']             },
  { id: 'benefit', label: 'Выгода',        lines: ['ТВОЯ ВЫГОДА!']               },
  { id: 'main',    label: 'Главное',       lines: ['ГЛАВНОЕ']                    },
]

// ─── Состояние ───────────────────────────────────────────────────────────────

const state = {
  photoImages: [],
  iconImages:  [],
  bannerCanvases: [],   // { canvas, label, type, makeFn, overrides }
}

const $id = id => document.getElementById(id)

// ─── Sync hex labels ─────────────────────────────────────────────────────────

for (const id of ['primaryColor', 'accentColor', 'bgColor', 'borderColor']) {
  const input = $id(id), hex = $id(id.replace('Color', 'Hex'))
  input.addEventListener('input', () => { if (hex) hex.textContent = input.value })
}

// ─── Мультизагрузка фото и иконок ───────────────────────────────────────────

setupMultiUpload('addPhotoBtn', 'filePhoto', 'photoThumbs', state.photoImages)
setupMultiUpload('addIconBtn',  'fileIcon',  'iconThumbs',  state.iconImages)

function setupMultiUpload(addBtnId, fileInputId, thumbsId, imageArray) {
  const addBtn   = $id(addBtnId)
  const fileInput = $id(fileInputId)

  addBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(f => loadImgFile(f, imageArray, thumbsId, addBtnId))
    fileInput.value = ''
  })
}

function loadImgFile(file, imageArray, thumbsId, addBtnId) {
  readImg(file, (img, dataUrl) => {
    imageArray.push(img)
    addThumb(dataUrl, img, imageArray, thumbsId, addBtnId)
    updateBtn()
  })
}

function addThumb(dataUrl, imgRef, imageArray, thumbsId, addBtnId) {
  const thumb = document.createElement('div')
  thumb.className = 'icon-thumb'
  thumb.style.backgroundImage = `url(${dataUrl})`

  const del = document.createElement('button')
  del.className = 'icon-thumb-del'; del.textContent = '×'
  del.addEventListener('click', e => {
    e.stopPropagation()
    const idx = imageArray.indexOf(imgRef)
    if (idx !== -1) imageArray.splice(idx, 1)
    thumb.remove(); updateBtn()
  })
  thumb.appendChild(del)
  $id(thumbsId).insertBefore(thumb, $id(addBtnId))
}

function readImg(file, cb) {
  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => cb(img, e.target.result)
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

function updateBtn() {
  $id('generateBtn').disabled = state.photoImages.length === 0 && state.iconImages.length === 0
}

// ─── Цвета ───────────────────────────────────────────────────────────────────

$id('fetchColorsBtn').addEventListener('click', async () => {
  const url = $id('siteUrl').value.trim()
  if (!url) return showError('fetchError', 'Введи URL сайта')
  const btn = $id('fetchColorsBtn')
  btn.disabled = true; btn.textContent = 'Загружаю...'
  hideError('fetchError')
  try {
    const res  = await fetch('/api/fetch-site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setColor('primaryColor', 'primaryHex', data.primaryColor)
    setColor('accentColor',  'accentHex',  data.accentColor)
    setColor('bgColor',      'bgHex',      data.bgColor)
    setColor('borderColor',  'borderHex',  data.borderColor)
    btn.textContent = '✓ Готово'
    setTimeout(() => { btn.textContent = 'Извлечь' }, 2500)
  } catch (err) { showError('fetchError', err.message); btn.textContent = 'Извлечь' }
  finally { btn.disabled = false }
})

function setColor(inputId, hexId, val) {
  if (!val) return
  $id(inputId).value = val
  const el = $id(hexId); if (el) el.textContent = val
}

// ─── Генерация ───────────────────────────────────────────────────────────────

$id('generateBtn').addEventListener('click', generate)

async function generate() {
  state.bannerCanvases = []
  $id('bannerGrid').innerHTML = ''
  $id('resultsSection').hidden = true
  hideError('generateError')

  const C = {
    primary: $id('primaryColor').value,
    accent:  $id('accentColor').value,
    bg:      $id('bgColor').value,
    border:  $id('borderColor').value,
  }
  const T = {
    category:  $id('category').value.trim(),
    heading:   $id('heading').value.trim(),
    subtitle:  $id('subtitle').value.trim(),
    eventDate: $id('eventDate').value.trim(),
  }

  const btn = $id('generateBtn')
  btn.disabled = true; btn.textContent = 'Рендерю...'

  try {
    await raf()

    const photos = state.photoImages
    const icons  = state.iconImages

    // Анонсные с контентом (нужно фото)
    if (photos.length > 0) {
      ANNOUNCE.forEach((tmpl, i) => {
        if (tmpl.id === 'withdate' && !T.eventDate) return
        // 'nodate' показываем всегда
        const img = photos[i % photos.length]
        emit(tmpl.label, 'tg',    makeAnnounceTG(tmpl, T, img, C))
        emit(tmpl.label, 'email', makeAnnounceEmail(tmpl, T, img, C))
      })

      // Анонсные простые (без контента)
      ANNOUNCE_SIMPLE.forEach((tmpl, i) => {
        const img = photos[i % photos.length]
        emit(tmpl.label, 'tg',    makeSimpleTG(tmpl, img, C))
        emit(tmpl.label, 'email', makeSimpleEmail(tmpl, img, C))
      })
    }

    // Статусные (нужны иконки или фото как fallback)
    const iconSrc = icons.length > 0 ? icons : photos
    if (iconSrc.length > 0) {
      STATUS.forEach((tmpl, i) => {
        const img = iconSrc[i % iconSrc.length]
        emit(tmpl.label, 'tg',    makeStatusTG(tmpl, img, C))
        emit(tmpl.label, 'email', makeStatusEmail(tmpl, img, C))
      })
    }

    $id('resultsSection').hidden = false
    $id('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (err) { showError('generateError', err.message); console.error(err) }
  finally { btn.disabled = false; btn.textContent = '◆ Генерировать баннеры'; updateBtn() }
}

function raf() { return new Promise(r => requestAnimationFrame(r)) }

function emit(label, type, makeFn) {
  const overrides = { imgOffsetX: 0, imgOffsetY: 0, imgScale: 1, imgOverride: null, textOffsetX: 0, textOffsetY: 0, textScale: 1 }
  const canvas = makeFn(overrides)
  const idx = state.bannerCanvases.length
  state.bannerCanvases.push({ canvas, label, type, makeFn, overrides })
  addCard(canvas, label, type, idx)
}

// ─── ANNOUNCE TG 1080×1080 ───────────────────────────────────────────────────

function makeAnnounceTG(tmpl, T, img, C) {
  return (ov) => {
    const W = 1080, H = 1080
    const c = mk(W, H), ctx = c.getContext('2d')
    const cx = W / 2, PAD = 44, MAX_W = W - PAD * 2
    const TEXT_H = Math.round(H * 0.52)

    ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, H)

    const ts = ov.textScale || 1
    const stack = buildStack(ctx, tmpl, T, MAX_W, 1.0 * ts)
    const sy = Math.max(28, Math.round((TEXT_H - stack.totalH) / 2)) + (ov.textOffsetY || 0)
    drawStack(ctx, stack, cx + (ov.textOffsetX || 0), sy, MAX_W, C.accent)

    const IP = 16
    drawImg(ctx, IP, TEXT_H, W - IP * 2, H - TEXT_H - IP, ov.imgOverride || img, C.primary, 18, ov, 'cover')
    return c
  }
}

// ─── ANNOUNCE Email 1080×420 ─────────────────────────────────────────────────

function makeAnnounceEmail(tmpl, T, img, C) {
  return (ov) => {
    const W = 1080, H = 420
    const c = mk(W, H), ctx = c.getContext('2d')
    const SPLIT = Math.round(W * 0.56), PAD = 32, MAX_W = SPLIT - PAD * 2, cx = PAD + MAX_W / 2

    ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, H)

    const IP = 14
    drawImg(ctx, SPLIT + IP, IP, W - SPLIT - IP * 2, H - IP * 2, ov.imgOverride || img, C.primary, 14, ov, 'cover')

    const ts = ov.textScale || 1
    const stack = buildStack(ctx, tmpl, T, MAX_W, 0.72 * ts)
    const sy = Math.max(16, Math.round((H - stack.totalH) / 2)) + (ov.textOffsetY || 0)
    drawStack(ctx, stack, cx + (ov.textOffsetX || 0), sy, MAX_W, C.accent)
    return c
  }
}

// ─── ANNOUNCE SIMPLE TG 1080×1080 (только плашка + фото) ────────────────────

function makeSimpleTG(tmpl, img, C) {
  return (ov) => {
    const W = 1080, H = 1080, cx = W / 2
    const c = mk(W, H), ctx = c.getContext('2d')
    const TEXT_H = Math.round(H * 0.36)

    ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, H)

    const ts = ov.textScale || 1
    const MAX_W = W - 80
    const fs = Math.round(72 * ts), pv = Math.round(18 * ts), ph = Math.round(36 * ts)
    const ph_ = fs + pv * 2
    const sy  = Math.round((TEXT_H - ph_) / 2) + (ov.textOffsetY || 0)
    drawAccentPlashka(ctx, cx + (ov.textOffsetX || 0), sy, tmpl.status, C.accent, fs, pv, ph, MAX_W)

    const IP = 16
    drawImg(ctx, IP, TEXT_H, W - IP * 2, H - TEXT_H - IP, ov.imgOverride || img, C.primary, 18, ov, 'cover')
    return c
  }
}

// ─── ANNOUNCE SIMPLE Email 1080×420 ─────────────────────────────────────────

function makeSimpleEmail(tmpl, img, C) {
  return (ov) => {
    const W = 1080, H = 420
    const c = mk(W, H), ctx = c.getContext('2d')
    const SPLIT = Math.round(W * 0.52), MAX_W = SPLIT - 60, cx = 30 + MAX_W / 2

    ctx.fillStyle = C.primary; ctx.fillRect(0, 0, W, H)

    const IP = 14
    drawImg(ctx, SPLIT + IP, IP, W - SPLIT - IP * 2, H - IP * 2, ov.imgOverride || img, C.primary, 14, ov, 'cover')

    const ts = ov.textScale || 1
    const fs = Math.round(58 * ts), pv = Math.round(16 * ts), ph = Math.round(30 * ts)
    const ph_ = fs + pv * 2
    const sy  = Math.round((H - ph_) / 2) + (ov.textOffsetY || 0)
    drawAccentPlashka(ctx, cx + (ov.textOffsetX || 0), sy, tmpl.status, C.accent, fs, pv, ph, MAX_W)
    return c
  }
}

// ─── STATUS TG 1080×1080 ─────────────────────────────────────────────────────

function makeStatusTG(tmpl, img, C) {
  return (ov) => {
    const W = 1080, H = 1080, cx = W / 2
    const c = mk(W, H), ctx = c.getContext('2d')

    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
    drawBorder(ctx, W, H, C.border, 20)

    const ts = ov.textScale || 1
    const fs = Math.round(76 * ts), pv = Math.round(18 * ts), ph = Math.round(36 * ts), gap = Math.round(14 * ts), MAX_W = W - 80
    const pH  = fs + pv * 2
    const totalH = tmpl.lines.length * pH + (tmpl.lines.length - 1) * gap
    const UPPER  = Math.max(totalH + 80, Math.round(H * 0.36))
    let y = Math.round((UPPER - totalH) / 2) + (ov.textOffsetY || 0)

    for (const line of tmpl.lines) {
      drawAccentPlashka(ctx, cx + (ov.textOffsetX || 0), y, line, C.accent, fs, pv, ph, MAX_W)
      y += pH + gap
    }

    // Иконка — contain чтобы не обрезалась
    const IP = 30
    drawImg(ctx, IP, UPPER, W - IP * 2, H - UPPER - IP, ov.imgOverride || img, C.bg, 16, ov, 'contain')
    return c
  }
}

// ─── STATUS Email 1080×420 ───────────────────────────────────────────────────

function makeStatusEmail(tmpl, img, C) {
  return (ov) => {
    const W = 1080, H = 420
    const c = mk(W, H), ctx = c.getContext('2d')
    const SPLIT = Math.round(W * 0.52), MAX_W = SPLIT - 60, cx = 30 + MAX_W / 2

    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
    drawBorder(ctx, W, H, C.border, 14)

    const IP = 24
    drawImg(ctx, SPLIT + IP, IP, W - SPLIT - IP * 2, H - IP * 2, ov.imgOverride || img, C.bg, 12, ov, 'contain')

    const ts = ov.textScale || 1
    const fs = Math.round(62 * ts), pv = Math.round(15 * ts), ph = Math.round(28 * ts), gap = Math.round(12 * ts)
    const pH  = fs + pv * 2
    const totalH = tmpl.lines.length * pH + (tmpl.lines.length - 1) * gap
    let y = Math.round((H - totalH) / 2) + (ov.textOffsetY || 0)

    for (const line of tmpl.lines) {
      drawAccentPlashka(ctx, cx + (ov.textOffsetX || 0), y, line, C.accent, fs, pv, ph, MAX_W)
      y += pH + gap
    }
    return c
  }
}

// ─── buildStack ───────────────────────────────────────────────────────────────

function buildStack(ctx, tmpl, T, maxW, scale) {
  const GAP = Math.round(20 * scale)
  const items = []

  if (tmpl.status) {
    const fs = Math.round(56 * scale), pv = Math.round(14 * scale), ph = Math.round(28 * scale)
    items.push({ type: 'accent', text: tmpl.status, h: fs + pv * 2, fs, pv, ph })
  }
  if (tmpl.showDate && T.eventDate) {
    const fs = Math.round(28 * scale), pv = Math.round(8 * scale)
    items.push({ type: 'date', text: T.eventDate, h: fs + pv * 2, fs, pv })
  }
  if (T.category) {
    const fs = Math.round(25 * scale), pv = Math.round(9 * scale), ph = Math.round(22 * scale)
    items.push({ type: 'outline', text: T.category, h: fs + pv * 2, fs, pv, ph })
  }
  if (T.heading) {
    const fs = Math.round(60 * scale)
    ctx.font = `700 ${fs}px -apple-system, Arial, sans-serif`
    const lines = wrapText(ctx, T.heading, maxW)
    items.push({ type: 'title', text: T.heading, h: Math.round(lines.length * fs * 1.13), fs })
  }
  if (T.subtitle) {
    const fs = Math.round(26 * scale)
    ctx.font = `400 ${fs}px -apple-system, Arial, sans-serif`
    const lines = wrapText(ctx, T.subtitle, maxW)
    items.push({ type: 'sub', text: T.subtitle, h: Math.round(lines.length * fs * 1.35), fs })
  }

  const totalH = items.reduce((s, it, i) => s + it.h + (i > 0 ? GAP : 0), 0)
  return { items, totalH, GAP }
}

function drawStack(ctx, stack, cx, sy, maxW, accent) {
  let y = sy
  for (let i = 0; i < stack.items.length; i++) {
    if (i > 0) y += stack.GAP
    const it = stack.items[i]
    switch (it.type) {
      case 'accent':  drawAccentPlashka(ctx, cx, y, it.text, accent, it.fs, it.pv, it.ph, maxW); break
      case 'date':    drawDatePill(ctx, cx, y, it.text, it.fs, it.pv); break
      case 'outline': drawOutlineTag(ctx, cx, y, it.text, it.fs, it.pv, it.ph, maxW); break
      case 'title':   drawMultiText(ctx, cx, y, it.text, it.fs, 1.13, maxW, '#fff', 700); break
      case 'sub':     drawMultiText(ctx, cx, y, it.text, it.fs, 1.35, maxW, 'rgba(255,255,255,0.72)', 400); break
    }
    y += it.h
  }
}

// ─── Примитивы ───────────────────────────────────────────────────────────────

function drawAccentPlashka(ctx, cx, y, text, color, fs, pv, ph, maxW) {
  // уменьшаем шрифт пока текст не влезает в maxW
  let f = fs
  ctx.font = `900 ${f}px 'Arial Black', Arial, sans-serif`
  while (ctx.measureText(text).width > maxW - ph * 2 && f > 14) {
    f -= 2
    ctx.font = `900 ${f}px 'Arial Black', Arial, sans-serif`
  }
  const tw = ctx.measureText(text).width
  const w = tw + ph * 2, h = fs + pv * 2, x = cx - w / 2
  ctx.fillStyle = color
  rrect(ctx, x, y, w, h, Math.max(6, Math.round(h * 0.13))); ctx.fill()
  ctx.fillStyle = contrastColor(color); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2)
  return h
}

function drawDatePill(ctx, cx, y, text, fs, pv) {
  const ph = Math.round(fs * 0.72)
  ctx.font = `500 ${fs}px -apple-system, Arial, sans-serif`
  const w = ctx.measureText(text).width + ph * 2, h = fs + pv * 2
  const x = cx - w / 2
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rrect(ctx, x, y, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; rrect(ctx, x, y, w, h, h / 2); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2)
  return h
}

function drawOutlineTag(ctx, cx, y, text, fs, pv, ph, maxW) {
  let f = fs
  ctx.font = `500 ${f}px -apple-system, Arial, sans-serif`
  while (ctx.measureText(text).width > maxW - ph * 2 && f > 11) {
    f -= 1; ctx.font = `500 ${f}px -apple-system, Arial, sans-serif`
  }
  const w = Math.min(ctx.measureText(text).width + ph * 2, maxW), h = f + pv * 2, x = cx - w / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 1.5; rrect(ctx, x, y, w, h, h / 2); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2)
  return h
}

function drawMultiText(ctx, cx, y, text, fs, lh, maxW, color, weight) {
  ctx.font = `${weight} ${fs}px -apple-system, Arial, sans-serif`
  const lines = wrapText(ctx, text, maxW), lhPx = fs * lh
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lhPx))
  return Math.round(lines.length * lhPx)
}

// mode: 'cover' (обрезает) | 'contain' (целиком, без обрезки)
function drawImg(ctx, x, y, w, h, img, bg, r, ov, mode) {
  if (!img || w <= 0 || h <= 0) return
  const { imgOffsetX = 0, imgOffsetY = 0, imgScale = 1 } = ov || {}

  ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip()
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h)

  const base = mode === 'cover'
    ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
    : Math.min(w / img.naturalWidth, h / img.naturalHeight)

  const s  = base * imgScale
  const sw = img.naturalWidth * s, sh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - sw) / 2 + imgOffsetX, y + (h - sh) / 2 + imgOffsetY, sw, sh)
  ctx.restore()
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

function drawBorder(ctx, W, H, color, lw) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw * 2; ctx.strokeRect(0, 0, W, H); ctx.restore()
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' '), lines = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

function isLight(hex) {
  if (!hex || hex.length < 7) return true
  return (parseInt(hex.slice(1,3),16)*299 + parseInt(hex.slice(3,5),16)*587 + parseInt(hex.slice(5,7),16)*114) / 1000 > 128
}
function contrastColor(hex) { return isLight(hex) ? '#000' : '#fff' }

// ─── UI карточки ─────────────────────────────────────────────────────────────

function addCard(canvas, label, type, idx) {
  const card = document.createElement('div')
  card.className = 'banner-card'; card.dataset.type = type; card.dataset.idx = idx

  const preview = document.createElement('canvas')
  preview.width = canvas.width; preview.height = canvas.height
  preview.getContext('2d').drawImage(canvas, 0, 0)

  const footer = document.createElement('div'); footer.className = 'banner-footer'
  const lbl = document.createElement('span'); lbl.className = 'banner-label'
  lbl.textContent = `${label} · ${type === 'tg' ? 'ТГ' : 'Email'}`

  const editBtn = document.createElement('button'); editBtn.className = 'banner-edit'
  editBtn.textContent = '✎'; editBtn.title = 'Редактировать'
  editBtn.onclick = () => openEditor(idx)

  const dl = document.createElement('button'); dl.className = 'banner-dl'; dl.textContent = '↓ PNG'
  dl.onclick = () => dlSingle(state.bannerCanvases[idx].canvas, label, type)

  footer.append(lbl, editBtn, dl); card.append(preview, footer)
  $id('bannerGrid').appendChild(card)
}

function updateCardPreview(idx) {
  const card = document.querySelector(`.banner-card[data-idx="${idx}"]`)
  if (!card) return
  const canvas = state.bannerCanvases[idx].canvas
  const preview = card.querySelector('canvas')
  preview.width = canvas.width; preview.height = canvas.height
  preview.getContext('2d').drawImage(canvas, 0, 0)
}

function dlSingle(canvas, label, type) {
  canvas.toBlob(blob => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${label.replace(/ /g,'_')}_${type}.png` })
    a.click(); URL.revokeObjectURL(a.href)
  }, 'image/png')
}

$id('downloadBtn').addEventListener('click', async () => {
  const btn = $id('downloadBtn'); btn.disabled = true; btn.textContent = 'Упаковываю...'
  try {
    const zip = new JSZip(), tg = zip.folder('ТГ_1080x1080'), email = zip.folder('Email_1080x420')
    for (const { canvas, label, type } of state.bannerCanvases) {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      ;(type === 'tg' ? tg : email).file(`${label.replace(/ /g,'_')}.png`, blob)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'banners.zip' })
    a.click(); URL.revokeObjectURL(a.href)
  } finally { btn.disabled = false; btn.textContent = '↓ Скачать ZIP' }
})

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    const grid = $id('bannerGrid'); grid.className = 'banner-grid'
    const t = tab.dataset.tab
    if (t === 'email') grid.classList.add('show-email')
    if (t === 'all')   grid.classList.add('show-all')
  })
})

// ─── Редактор ────────────────────────────────────────────────────────────────

let editorIdx = -1
let editorDrag = null
let editorMode = 'img'

const editorModal  = $id('editorModal')
const editorCanvas = $id('editorCanvas')
const editorCtx    = editorCanvas.getContext('2d')
const scaleSlider  = $id('imgScaleSlider')

// Переключение режимов Картинка / Текст
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    editorMode = tab.dataset.mode
    $id('imgControls').classList.toggle('hidden', editorMode !== 'img')
    $id('textControls').classList.toggle('hidden', editorMode !== 'text')
  })
})

function openEditor(idx) {
  editorIdx = idx
  editorMode = 'img'
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'img'))
  $id('imgControls').classList.remove('hidden')
  $id('textControls').classList.add('hidden')
  const entry = state.bannerCanvases[idx]
  $id('editorTitle').textContent = `${entry.label} · ${entry.type === 'tg' ? 'ТГ' : 'Email'}`
  scaleSlider.value = entry.overrides.imgScale
  $id('textScaleSlider').value = entry.overrides.textScale
  renderEditorCanvas()
  editorModal.classList.remove('hidden')
}

function closeEditor() {
  editorModal.classList.add('hidden')
  editorIdx = -1; editorDrag = null
}

function renderEditorCanvas() {
  if (editorIdx < 0) return
  const entry = state.bannerCanvases[editorIdx]
  const newCanvas = entry.makeFn(entry.overrides)
  entry.canvas = newCanvas
  editorCanvas.width  = newCanvas.width
  editorCanvas.height = newCanvas.height
  editorCtx.drawImage(newCanvas, 0, 0)
}

// Drag на canvas
const editorWrap = document.querySelector('.editor-canvas-wrap')

editorWrap.addEventListener('mousedown', e => {
  if (editorIdx < 0) return
  const ov = state.bannerCanvases[editorIdx].overrides
  const ratio = editorCanvas.width / editorWrap.offsetWidth
  if (editorMode === 'text') {
    editorDrag = { startX: e.clientX, startY: e.clientY, startOX: ov.textOffsetX, startOY: ov.textOffsetY, ratio, mode: 'text' }
  } else {
    editorDrag = { startX: e.clientX, startY: e.clientY, startOX: ov.imgOffsetX, startOY: ov.imgOffsetY, ratio, mode: 'img' }
  }
  e.preventDefault()
})

window.addEventListener('mousemove', e => {
  if (!editorDrag || editorIdx < 0) return
  const ov = state.bannerCanvases[editorIdx].overrides
  const dx = (e.clientX - editorDrag.startX) * editorDrag.ratio
  const dy = (e.clientY - editorDrag.startY) * editorDrag.ratio
  if (editorDrag.mode === 'text') {
    ov.textOffsetX = editorDrag.startOX + dx
    ov.textOffsetY = editorDrag.startOY + dy
  } else {
    ov.imgOffsetX = editorDrag.startOX + dx
    ov.imgOffsetY = editorDrag.startOY + dy
  }
  renderEditorCanvas()
})

window.addEventListener('mouseup', () => { editorDrag = null })

// Touch поддержка
editorWrap.addEventListener('touchstart', e => {
  if (editorIdx < 0) return
  const t = e.touches[0]
  const ov = state.bannerCanvases[editorIdx].overrides
  const ratio = editorCanvas.width / editorWrap.offsetWidth
  if (editorMode === 'text') {
    editorDrag = { startX: t.clientX, startY: t.clientY, startOX: ov.textOffsetX, startOY: ov.textOffsetY, ratio, mode: 'text' }
  } else {
    editorDrag = { startX: t.clientX, startY: t.clientY, startOX: ov.imgOffsetX, startOY: ov.imgOffsetY, ratio, mode: 'img' }
  }
  e.preventDefault()
}, { passive: false })

window.addEventListener('touchmove', e => {
  if (!editorDrag || editorIdx < 0) return
  const t = e.touches[0]
  const ov = state.bannerCanvases[editorIdx].overrides
  const dx = (t.clientX - editorDrag.startX) * editorDrag.ratio
  const dy = (t.clientY - editorDrag.startY) * editorDrag.ratio
  if (editorDrag.mode === 'text') {
    ov.textOffsetX = editorDrag.startOX + dx
    ov.textOffsetY = editorDrag.startOY + dy
  } else {
    ov.imgOffsetX = editorDrag.startOX + dx
    ov.imgOffsetY = editorDrag.startOY + dy
  }
  renderEditorCanvas()
}, { passive: true })

window.addEventListener('touchend', () => { editorDrag = null })

// Слайдер масштаба картинки
scaleSlider.addEventListener('input', () => {
  if (editorIdx < 0) return
  state.bannerCanvases[editorIdx].overrides.imgScale = parseFloat(scaleSlider.value)
  renderEditorCanvas()
})

// Слайдер масштаба текста
$id('textScaleSlider').addEventListener('input', () => {
  if (editorIdx < 0) return
  state.bannerCanvases[editorIdx].overrides.textScale = parseFloat($id('textScaleSlider').value)
  renderEditorCanvas()
})

// Сброс текста
$id('textReset').addEventListener('click', () => {
  if (editorIdx < 0) return
  const ov = state.bannerCanvases[editorIdx].overrides
  ov.textOffsetX = 0; ov.textOffsetY = 0; ov.textScale = 1
  $id('textScaleSlider').value = 1
  renderEditorCanvas()
})

// Сменить картинку
$id('imgReplaceBtn').addEventListener('click', () => $id('imgReplaceFile').click())
$id('imgReplaceFile').addEventListener('change', () => {
  const file = $id('imgReplaceFile').files[0]; if (!file || editorIdx < 0) return
  readImg(file, (img) => {
    state.bannerCanvases[editorIdx].overrides.imgOverride = img
    renderEditorCanvas()
    $id('imgReplaceFile').value = ''
  })
})

// Сброс
$id('editorReset').addEventListener('click', () => {
  if (editorIdx < 0) return
  const ov = state.bannerCanvases[editorIdx].overrides
  ov.imgOffsetX = 0; ov.imgOffsetY = 0; ov.imgScale = 1; ov.imgOverride = null
  scaleSlider.value = 1; renderEditorCanvas()
})

// Сохранить
$id('editorSave').addEventListener('click', () => {
  updateCardPreview(editorIdx)
  closeEditor()
})

// Закрыть
$id('modalClose').addEventListener('click', closeEditor)
$id('editorCancel').addEventListener('click', closeEditor)
$id('modalOverlay').addEventListener('click', closeEditor)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showError(id, msg) { const el = $id(id); el.textContent = msg; el.hidden = false }
function hideError(id)       { $id(id).hidden = true }
