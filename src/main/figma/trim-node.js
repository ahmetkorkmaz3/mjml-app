// The REST API returns a large node tree. The model needs only the layout,
// the colors, the text and the fonts, so this removes everything else.
// Vectors and nodes with export settings become images.

const VECTOR_TYPES = new Set([
  'VECTOR',
  'BOOLEAN_OPERATION',
  'STAR',
  'LINE',
  'ELLIPSE',
  'REGULAR_POLYGON',
])

const LAYOUT_KEYS = [
  'layoutMode',
  'itemSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'layoutSizingHorizontal',
  'layoutSizingVertical',
  'cornerRadius',
  'strokeWeight',
  'opacity',
]

const STYLE_KEYS = [
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeightPx',
  'letterSpacing',
  'textAlignHorizontal',
  'textDecoration',
  'textCase',
  'italic',
]

function channel(value) {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

export function toHex({ r, g, b, a = 1 }, opacity = 1) {
  const alpha = a * opacity
  return `#${channel(r)}${channel(g)}${channel(b)}${alpha < 1 ? channel(alpha) : ''}`
}

function isAllVectors(node) {
  return (
    Array.isArray(node.children) &&
    node.children.length > 0 &&
    node.children.every(child => VECTOR_TYPES.has(child.type) || isAllVectors(child))
  )
}

export function trimNode(root) {
  const exports = []
  const imageFills = []

  function paints(list, nodeName) {
    return (list || [])
      .filter(paint => paint.visible !== false)
      .map(paint => {
        if (paint.type === 'SOLID') {
          return { type: 'SOLID', color: toHex(paint.color, paint.opacity ?? 1) }
        }
        if (paint.type === 'IMAGE') {
          if (!imageFills.some(fill => fill.imageRef === paint.imageRef)) {
            imageFills.push({ imageRef: paint.imageRef, name: nodeName })
          }
          return { type: 'IMAGE', imageRef: paint.imageRef, scaleMode: paint.scaleMode }
        }
        if (paint.type.startsWith('GRADIENT')) {
          return {
            type: paint.type,
            stops: (paint.gradientStops || []).map(stop => toHex(stop.color)),
          }
        }
        return { type: paint.type }
      })
  }

  function walk(node, isRoot) {
    if (node.visible === false) {
      return null
    }

    const out = { id: node.id, name: node.name, type: node.type }
    const box = node.absoluteBoundingBox
    if (box) {
      out.box = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      }
    }

    // the root is the email itself: designers often mark it for export,
    // but it must stay a layout node
    const hasExport = !isRoot && Array.isArray(node.exportSettings) && node.exportSettings.length
    if (!isRoot && (VECTOR_TYPES.has(node.type) || hasExport || isAllVectors(node))) {
      out.exportAsImage = true
      exports.push({ id: node.id, name: node.name })
      return out
    }

    for (const key of LAYOUT_KEYS) {
      if (node[key] !== undefined) {
        out[key] = node[key]
      }
    }

    const fills = paints(node.fills, node.name)
    if (fills.length) {
      out.fills = fills
    }
    const strokes = paints(node.strokes, node.name)
    if (strokes.length) {
      out.strokes = strokes
    }

    if (node.characters !== undefined) {
      out.text = node.characters
    }
    if (node.style) {
      out.style = {}
      for (const key of STYLE_KEYS) {
        if (node.style[key] !== undefined) {
          out.style[key] = node.style[key]
        }
      }
    }

    if (Array.isArray(node.children)) {
      const children = node.children.map(child => walk(child, false)).filter(Boolean)
      if (children.length) {
        out.children = children
      }
    }

    return out
  }

  return { tree: walk(root, true), exports, imageFills }
}
