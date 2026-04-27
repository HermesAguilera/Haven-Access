import axios from 'axios'
import { QR_ALLOWED_SKEW_STEPS, QR_CODE_DIGITS, QR_TIME_STEP_SECONDS, createVisitQrCode, decodeVisitQrToken, type VisitQrTokenPayload } from '../utils/visitQr'
import {
  deletePendingSyncLog,
  getActiveVisitsCache,
  listPendingSyncLogs,
  saveActiveVisitsCache,
  savePendingSyncLog,
  type ActiveVisitsPayload,
  type CachedVisitSnapshot,
  type PendingSyncLogRecord,
} from './offline-cache'

export type SyncContext = {
  apiBaseUrl: string
  accessToken: string
  residentialId: string
  guardId: string
  shiftId?: string | null
}

export type ValidationOutcome = {
  source: 'api' | 'offline'
  visitId: string
  pendingSyncId?: string
  message: string
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/u, '')
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function isTerminalStatus(status: CachedVisitSnapshot['status']) {
  return ['REJECTED', 'USED', 'EXPIRED', 'CANCELLED'].includes(status)
}

async function deriveAesKey(material: string) {
  const encodedMaterial = new TextEncoder().encode(material)
  const digest = await crypto.subtle.digest('SHA-256', encodedMaterial)

  return await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function decryptActiveVisitsPackage(encryptedPayload: string, iv: string, material: string) {
  const key = await deriveAesKey(material)
  const ciphertext = base64ToBytes(encryptedPayload)
  const initializationVector = base64ToBytes(iv)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: initializationVector }, key, ciphertext)

  return JSON.parse(new TextDecoder().decode(new Uint8Array(decrypted))) as ActiveVisitsPayload
}

async function encryptActiveVisitsPayload(payload: ActiveVisitsPayload, material: string) {
  const key = await deriveAesKey(material)
  const initializationVector = crypto.getRandomValues(new Uint8Array(12))
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: initializationVector }, key, encodedPayload)

  return {
    iv: bufferToBase64(initializationVector.buffer),
    encryptedPayload: bufferToBase64(encrypted),
  }
}

function decodeToken(qrToken: string): VisitQrTokenPayload {
  const decoded = decodeVisitQrToken(qrToken)

  if (!decoded.visitId || !Number.isInteger(decoded.timestamp) || !decoded.code || decoded.code.length !== QR_CODE_DIGITS) {
    throw new Error('Invalid QR token')
  }

  return {
    visitId: decoded.visitId,
    timestamp: decoded.timestamp as number,
    code: decoded.code,
  }
}

function getCurrentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

async function validateTokenAgainstCache(qrToken: string, cachedVisits: CachedVisitSnapshot[]) {
  const tokenPayload = decodeToken(qrToken)
  const visit = cachedVisits.find((entry) => entry.id === tokenPayload.visitId)

  if (!visit) {
    throw new Error('Visit not found in the offline cache')
  }

  if (!visit.qrSecret) {
    throw new Error('Visit QR secret is missing from the offline cache')
  }

  const timestampDelta = Math.abs(Date.now() - tokenPayload.timestamp)
  const allowedDriftMs = QR_TIME_STEP_SECONDS * 1000 * QR_ALLOWED_SKEW_STEPS

  if (timestampDelta > allowedDriftMs) {
    throw new Error('QR token expired')
  }

  const expectedCode = await createVisitQrCode(visit.qrSecret, tokenPayload.timestamp)

  if (expectedCode !== tokenPayload.code) {
    throw new Error('Invalid QR token')
  }

  if (isTerminalStatus(visit.status)) {
    throw new Error(`Visit cannot be validated while it is ${visit.status.toLowerCase()}`)
  }

  if (visit.startTime && visit.endTime) {
    const [startHours, startMinutes] = visit.startTime.split(':').map(Number)
    const [endHours, endMinutes] = visit.endTime.split(':').map(Number)
    const startTotalMinutes = startHours * 60 + startMinutes
    const endTotalMinutes = endHours * 60 + endMinutes
    const currentMinutes = getCurrentMinutes()
    const isWithinSchedule = startTotalMinutes <= endTotalMinutes
      ? currentMinutes >= startTotalMinutes && currentMinutes <= endTotalMinutes
      : currentMinutes >= startTotalMinutes || currentMinutes <= endTotalMinutes

    if (!isWithinSchedule) {
      throw new Error('Visit is outside the allowed schedule')
    }
  }

  return visit
}

async function persistOfflineCache(residentialId: string, payload: ActiveVisitsPayload) {
  const encryptedCache = await encryptActiveVisitsPayload(payload, `${residentialId}:cached`)

  await saveActiveVisitsCache({
    residentialId,
    generatedAt: payload.generatedAt,
    encryptedPayload: encryptedCache.encryptedPayload,
    iv: encryptedCache.iv,
  })
}

function isOfflineFailure(error: unknown) {
  return axios.isAxiosError(error) && !error.response
}

export class OfflineValidationService {
  private onlineListener: (() => void) | null = null

  async syncActiveVisits(context: SyncContext) {
    const client = axios.create({ baseURL: normalizeBaseUrl(context.apiBaseUrl) || 'http://localhost:3000' })
    const response = await client.get<{ generatedAt: string; iv: string; encryptedPayload: string; visitCount: number }>('/sync/active-visits', {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        'x-residential-id': context.residentialId,
      },
    })

    const payload = await decryptActiveVisitsPackage(response.data.encryptedPayload, response.data.iv, `${context.residentialId}:${context.accessToken}`)
    await persistOfflineCache(context.residentialId, payload)

    return payload
  }

  async validateVisitToken(qrToken: string, context: SyncContext): Promise<ValidationOutcome> {
    const client = axios.create({ baseURL: normalizeBaseUrl(context.apiBaseUrl) || 'http://localhost:3000' })

    try {
      const response = await client.post<{ visit: { id: string } }>('/visits/validate', { qrToken }, {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          'x-residential-id': context.residentialId,
        },
      })

      return {
        source: 'api',
        visitId: response.data.visit.id,
        message: 'Visit validated against the API',
      }
    } catch (error) {
      if (!isOfflineFailure(error)) {
        throw error
      }

      const cachedVisits = await getActiveVisitsCache(context.residentialId)

      if (!cachedVisits) {
        throw new Error('No offline visit cache is available')
      }

      const payload = await decryptActiveVisitsPackage(cachedVisits.encryptedPayload, cachedVisits.iv, `${context.residentialId}:cached`)
      const visit = await validateTokenAgainstCache(qrToken, payload.visits)

      if (visit.visitType === 'SINGLE_ACCESS') {
        await persistOfflineCache(context.residentialId, {
          ...payload,
          visits: payload.visits.map((currentVisit) => (currentVisit.id === visit.id ? { ...currentVisit, status: 'USED' } : currentVisit)),
        })
      }

      const pendingSyncId = crypto.randomUUID()
      const pendingSyncLog: PendingSyncLogRecord = {
        id: pendingSyncId,
        visitId: visit.id,
        guardId: context.guardId,
        residentialId: context.residentialId,
        shiftId: context.shiftId ?? null,
        qrToken,
        validatedAt: new Date().toISOString(),
      }

      await savePendingSyncLog(pendingSyncLog)

      return {
        source: 'offline',
        visitId: visit.id,
        pendingSyncId,
        message: 'Visit validated from the local cache and queued for sync',
      }
    }
  }

  async flushPendingSyncLogs(context: SyncContext) {
    const pendingLogs = await listPendingSyncLogs()

    if (!pendingLogs.length) {
      return 0
    }

    const client = axios.create({ baseURL: normalizeBaseUrl(context.apiBaseUrl) || 'http://localhost:3000' })

    await client.post('/sync/pending-sync-logs', { logs: pendingLogs }, {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        'x-residential-id': context.residentialId,
      },
    })

    await Promise.all(pendingLogs.map((log) => deletePendingSyncLog(log.id)))

    return pendingLogs.length
  }

  startAutoSync(context: SyncContext) {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    const flush = () => {
      void this.flushPendingSyncLogs(context)
    }

    this.onlineListener = flush
    window.addEventListener('online', flush)

    if (navigator.onLine) {
      flush()
    }

    return () => this.stopAutoSync()
  }

  stopAutoSync() {
    if (typeof window === 'undefined' || !this.onlineListener) {
      return
    }

    window.removeEventListener('online', this.onlineListener)
    this.onlineListener = null
  }
}

export const offlineValidationService = new OfflineValidationService()