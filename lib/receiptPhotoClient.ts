import { createReceiptPhotoUploadTarget } from "@/app/actions/receipts"
import { createClient } from "@/lib/supabase"

const RECEIPT_TARGET_BYTES = 650_000
const RECEIPT_HARD_LIMIT_BYTES = 950_000
const RECEIPT_MAX_DIMENSION = 1200
const RECEIPT_MIN_SCALE = 0.2
const RECEIPT_SCALE_STEPS = [1, 0.85, 0.72, 0.6, 0.48, 0.36, 0.28, 0.22] as const
const RECEIPT_QUALITY_STEPS = [0.76, 0.68, 0.6, 0.52, 0.44, 0.36] as const
const RECEIPT_PHOTO_PATH_DATA_URL_PARAM = "receipt-photo-path"
const RECEIPT_THUMBNAIL_MAX_DIMENSION = 320
const RECEIPT_THUMBNAIL_QUALITY = 0.5
const RECEIPT_FALLBACK_THUMBNAIL_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0CiiigD//2Q=="

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

function getMimeTypeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/)

  return match?.[1]?.trim().toLowerCase() || "image/jpeg"
}

function dataUrlToBlob(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",")

  if (separatorIndex === -1) {
    throw new Error("Unable to prepare the receipt photo.")
  }

  const base64Payload = dataUrl.slice(separatorIndex + 1)
  const mimeType = getMimeTypeFromDataUrl(dataUrl)
  const binary = window.atob(base64Payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

function buildScaleCandidates(image: HTMLImageElement) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return []
  }

  const maxSourceDimension = Math.max(sourceWidth, sourceHeight)
  const baseScale =
    maxSourceDimension > RECEIPT_MAX_DIMENSION
      ? RECEIPT_MAX_DIMENSION / maxSourceDimension
      : 1

  return Array.from(
    new Set(
      RECEIPT_SCALE_STEPS.map((step) =>
        Math.max(RECEIPT_MIN_SCALE, Number((baseScale * step).toFixed(3)))
      )
    )
  ).filter((scale) => scale > 0 && scale <= 1)
}

function renderReceiptThumbnailDataUrl(image: HTMLImageElement) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return RECEIPT_FALLBACK_THUMBNAIL_DATA_URL
  }

  const maxSourceDimension = Math.max(sourceWidth, sourceHeight)
  const scale = Math.min(1, RECEIPT_THUMBNAIL_MAX_DIMENSION / maxSourceDimension)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  return renderReceiptVariant(image, width, height, RECEIPT_THUMBNAIL_QUALITY)
}

function buildReceiptPhotoPathMarkerDataUrl(
  receiptPhotoPath: string,
  thumbnailDataUrl: string
) {
  const separatorIndex = thumbnailDataUrl.indexOf(",")
  const thumbnailPayload =
    separatorIndex === -1 ? "" : thumbnailDataUrl.slice(separatorIndex + 1)

  return `data:image/jpeg;${RECEIPT_PHOTO_PATH_DATA_URL_PARAM}=${encodeURIComponent(
    receiptPhotoPath
  )};base64,${thumbnailPayload}`
}

async function uploadReceiptPhotoDirectly(dataUrl: string) {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const target = await createReceiptPhotoUploadTarget(blob.type || "image/jpeg")

    if (!target.ok || !target.receiptPhotoPath || !target.uploadToken) {
      return null
    }

    const { error } = await createClient()
      .storage
      .from("receipts")
      .uploadToSignedUrl(target.receiptPhotoPath, target.uploadToken, blob, {
        contentType: blob.type || "image/jpeg",
      })

    if (error) {
      return null
    }

    return target.receiptPhotoPath
  } catch {
    return null
  }
}

function findCompressedReceiptDataUrl(image: HTMLImageElement) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const scaleCandidates = buildScaleCandidates(image)

  if (sourceWidth <= 0 || sourceHeight <= 0 || scaleCandidates.length === 0) {
    throw new Error("Unable to prepare the receipt photo.")
  }

  let smallestCandidate = ""
  let smallestCandidateBytes = Number.POSITIVE_INFINITY

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

  if (!smallestCandidate) {
    throw new Error("Unable to prepare the receipt photo.")
  }

  return smallestCandidate
}

export async function prepareReceiptPhotoDataUrl(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file)
  const originalBytes = estimateBase64PayloadBytes(originalDataUrl)

  let uploadDataUrl = originalDataUrl
  let fallbackDataUrl = originalDataUrl
  let thumbnailDataUrl = RECEIPT_FALLBACK_THUMBNAIL_DATA_URL

  try {
    const image = await loadImageFromDataUrl(originalDataUrl)
    const compressedDataUrl = findCompressedReceiptDataUrl(image)

    uploadDataUrl = compressedDataUrl
    fallbackDataUrl = compressedDataUrl
    thumbnailDataUrl = renderReceiptThumbnailDataUrl(image)
  } catch {
    if (originalBytes > RECEIPT_HARD_LIMIT_BYTES) {
      const uploadedReceiptPhotoPath = await uploadReceiptPhotoDirectly(uploadDataUrl)

      if (uploadedReceiptPhotoPath) {
        return buildReceiptPhotoPathMarkerDataUrl(
          uploadedReceiptPhotoPath,
          thumbnailDataUrl
        )
      }

      throw getReceiptTooLargeError()
    }
  }

  const uploadedReceiptPhotoPath = await uploadReceiptPhotoDirectly(uploadDataUrl)

  if (uploadedReceiptPhotoPath) {
    return buildReceiptPhotoPathMarkerDataUrl(
      uploadedReceiptPhotoPath,
      thumbnailDataUrl
    )
  }

  if (estimateBase64PayloadBytes(fallbackDataUrl) > RECEIPT_HARD_LIMIT_BYTES) {
    throw getReceiptTooLargeError()
  }

  return fallbackDataUrl
}
