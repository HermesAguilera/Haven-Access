export const QR_TIME_STEP_SECONDS = 30
export const QR_ALLOWED_SKEW_STEPS = 1
export const QR_CODE_DIGITS = 6
const QR_HASH_ALGORITHM = 'SHA-256'

export type VisitQrTokenPayload = {
  visitId: string
  timestamp: number
  code: string
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

async function createHmacDigest(secret: string, counter: number) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: QR_HASH_ALGORITHM },
    false,
    ['sign'],
  )

  const counterBuffer = new ArrayBuffer(8)
  new DataView(counterBuffer).setBigUint64(0, BigInt(counter))

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer)
  return new Uint8Array(signature)
}

function getTimeStep(timestampMs: number) {
  return Math.floor(timestampMs / (QR_TIME_STEP_SECONDS * 1000))
}

export async function createVisitQrCode(secret: string, timestampMs = Date.now()) {
  const digest = await createHmacDigest(secret, getTimeStep(timestampMs))
  const offset = digest[digest.length - 1] & 0x0f
  const binaryCode =
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)

  return (binaryCode % 10 ** QR_CODE_DIGITS).toString().padStart(QR_CODE_DIGITS, '0')
}

export function buildVisitQrToken(payload: VisitQrTokenPayload) {
  return encodeBase64Url(JSON.stringify(payload))
}

export function decodeVisitQrToken(qrToken: string) {
  const normalizedToken = qrToken.replace(/-/g, '+').replace(/_/g, '/')
  const paddedToken = `${normalizedToken}${'='.repeat((4 - (normalizedToken.length % 4)) % 4)}`
  const decoded = atob(paddedToken)
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))

  return JSON.parse(new TextDecoder().decode(bytes)) as Partial<VisitQrTokenPayload>
}
