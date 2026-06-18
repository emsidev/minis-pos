export type AuthSearchParamValue = string | string[] | undefined

type AuthMessageMap = Record<string, string>

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait at least 60 seconds before trying again."

export function readQueryValue(value: AuthSearchParamValue) {
  return Array.isArray(value) ? value[0] : value
}

export function formatAuthMessage(
  message: string | undefined,
  mappedMessages: AuthMessageMap = {}
) {
  if (!message) {
    return null
  }

  if (mappedMessages[message]) {
    return mappedMessages[message]
  }

  try {
    const decoded = decodeURIComponent(message)

    if (mappedMessages[decoded]) {
      return mappedMessages[decoded]
    }

    const lowered = decoded.toLowerCase()

    if (
      lowered.includes("rate limit") ||
      lowered.includes("too many requests") ||
      lowered.includes("email rate limit")
    ) {
      return RATE_LIMIT_MESSAGE
    }

    return decoded
  } catch {
    return message
  }
}
