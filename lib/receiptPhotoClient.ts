const RECEIPT_TARGET_BYTES = 1_500_000
const RECEIPT_HARD_LIMIT_BYTES = 2_500_000
const RECEIPT_MAX_DIMENSION = 1600
const RECEIPT_MIN_SCALE = 0.45
const RECEIPT_SCALE_STEPS = [1, 0.85, 0.72, 0.6] as const
const RECEIPT_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58] as const

function estimateBase64PayloadBytes(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",")

  if (separatorIndex === -1) {
    return 0
  }

  const base64Payload = dataUrl.slice(separatorIndex + 1)
  const paddingLength = base64Payload.endsWith("==")
    ? 2
    : base64Payload.endsWith("=")
      ? 1
      : 0

  return Math.max(0, Math.floor((base64Payload.length * 3) / 4) - paddingLength)
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () =>
      reject(new Error("Unable to read the receipt photo."))
    reader.onloadend = () => {
      if (
        typeof reader.result === "string" &&
        reader.result.trim().length > 0
      ) {
        resolve(reader.result)
        return
      }

      reject(new Error("Unable to read the receipt photo."))
    }

    reader.readAsDataURL(file)
  })
}

async function loadImageFromDataUrl(dataUrl: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()

    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error("Unable to prepare the receipt photo."))
    image.src = dataUrl
  })
}

function renderReceiptVariant(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number
) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Unable to prepare the receipt photo.")
  }

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL("image/jpeg", quality)
}

function getReceiptTooLargeError() {
  return new Error(
    "Receipt photo is too large. Retake it a bit closer before saving."
  )
}

export async function prepareReceiptPhotoDataUrl(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file)
  const originalBytes = estimateBase64PayloadBytes(originalDataUrl)

  if (originalBytes <= RECEIPT_TARGET_BYTES) {
    return originalDataUrl
  }

  let image: HTMLImageElement
  try {
    image = await loadImageFromDataUrl(originalDataUrl)
  } catch {
    if (originalBytes > RECEIPT_HARD_LIMIT_BYTES) {
      throw getReceiptTooLargeError()
    }

    return originalDataUrl
  }

  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    if (originalBytes > RECEIPT_HARD_LIMIT_BYTES) {
      throw getReceiptTooLargeError()
    }

    return originalDataUrl
  }

  const maxSourceDimension = Math.max(sourceWidth, sourceHeight)
  const baseScale =
    maxSourceDimension > RECEIPT_MAX_DIMENSION
      ? RECEIPT_MAX_DIMENSION / maxSourceDimension
      : 1
  const scaleCandidates = Array.from(
    new Set(
      RECEIPT_SCALE_STEPS.map((step) =>
        Math.max(RECEIPT_MIN_SCALE, Number((baseScale * step).toFixed(3)))
      )
    )
  ).filter((scale) => scale > 0 && scale <= 1)

  let smallestCandidate = originalDataUrl
  let smallestCandidateBytes = originalBytes

  // Keep receipt uploads comfortably below the server-action payload ceiling.
  for (const scale of scaleCandidates) {
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))

    for (const quality of RECEIPT_QUALITY_STEPS) {
      const candidate = renderReceiptVariant(image, width, height, quality)
      const candidateBytes = estimateBase64PayloadBytes(candidate)

      if (candidateBytes < smallestCandidateBytes) {
        smallestCandidate = candidate
        smallestCandidateBytes = candidateBytes
      }

      if (candidateBytes <= RECEIPT_TARGET_BYTES) {
        return candidate
      }
    }
  }

  if (smallestCandidateBytes > RECEIPT_HARD_LIMIT_BYTES) {
    throw getReceiptTooLargeError()
  }

  return smallestCandidate
}
