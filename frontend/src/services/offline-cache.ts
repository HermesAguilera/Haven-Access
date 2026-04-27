export type ActiveVisitCacheRecord = {
  residentialId: string
  generatedAt: string
  encryptedPayload: string
  iv: string
}

export type CachedVisitSnapshot = {
  id: string
  visitorName: string
  qrSecret: string
  visitType: 'SINGLE_ACCESS' | 'RECURRENT' | 'PERMANENT'
  startTime: string | null
  endTime: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'USED' | 'EXPIRED' | 'CANCELLED'
  expiresAt: string
  residentId: string
  residentialId: string
  createdAt: string
  updatedAt: string
}

export type ActiveVisitsPayload = {
  residentialId: string
  generatedAt: string
  visits: CachedVisitSnapshot[]
}

export type PendingSyncLogRecord = {
  id: string
  visitId: string | null
  guardId: string
  residentialId: string
  shiftId: string | null
  qrToken: string
  validatedAt: string
}

const ACTIVE_VISITS_STORAGE_KEY = 'haven-access:active-visits-cache'
const PENDING_SYNC_LOGS_STORAGE_KEY = 'haven-access:pending-sync-logs'

function readJson<T>(key: string, fallback: T) {
  const rawValue = localStorage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export async function saveActiveVisitsCache(record: ActiveVisitCacheRecord) {
  const cache = readJson<Record<string, ActiveVisitCacheRecord>>(ACTIVE_VISITS_STORAGE_KEY, {})
  cache[record.residentialId] = record
  writeJson(ACTIVE_VISITS_STORAGE_KEY, cache)
}

export async function getActiveVisitsCache(residentialId: string) {
  const cache = readJson<Record<string, ActiveVisitCacheRecord>>(ACTIVE_VISITS_STORAGE_KEY, {})
  return cache[residentialId] ?? null
}

export async function savePendingSyncLog(record: PendingSyncLogRecord) {
  const pendingSyncLogs = readJson<PendingSyncLogRecord[]>(PENDING_SYNC_LOGS_STORAGE_KEY, [])
  const nextPendingSyncLogs = pendingSyncLogs.filter((pendingSyncLog) => pendingSyncLog.id !== record.id)
  nextPendingSyncLogs.push(record)
  writeJson(PENDING_SYNC_LOGS_STORAGE_KEY, nextPendingSyncLogs)
}

export async function listPendingSyncLogs() {
  return readJson<PendingSyncLogRecord[]>(PENDING_SYNC_LOGS_STORAGE_KEY, [])
}

export async function deletePendingSyncLog(id: string) {
  const pendingSyncLogs = readJson<PendingSyncLogRecord[]>(PENDING_SYNC_LOGS_STORAGE_KEY, [])
  writeJson(
    PENDING_SYNC_LOGS_STORAGE_KEY,
    pendingSyncLogs.filter((pendingSyncLog) => pendingSyncLog.id !== id),
  )
}