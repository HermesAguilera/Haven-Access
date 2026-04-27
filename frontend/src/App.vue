<script setup lang="ts">
import axios from 'axios'
import * as QRCode from 'qrcode'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  QR_ALLOWED_SKEW_STEPS,
  QR_TIME_STEP_SECONDS,
  buildVisitQrToken,
  createVisitQrCode,
} from './utils/visitQr'

type VisitType = 'SINGLE_ACCESS' | 'RECURRENT' | 'PERMANENT'

type CreatedVisit = {
  id: string
  visitorName: string
  qrSecret: string
  visitType: VisitType
  startTime: string | null
  endTime: string | null
  status: string
  expiresAt: string
  residentId: string
  createdAt: string
  updatedAt: string
}

const apiBaseUrl = ref(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000')
const authToken = ref('')
const residentialId = ref('')
const visitorName = ref('Carlos Perez')
const residentId = ref('7f83f1b1-7b0d-4a6a-9a4d-6d0f0a6d9c80')
const visitType = ref<VisitType>('SINGLE_ACCESS')
const startTime = ref('')
const endTime = ref('')
const currentTimestamp = ref(Date.now())
const visitId = ref('')
const qrSecret = ref('')
const qrToken = ref('')
const qrImage = ref('')
const otpCode = ref('')
const statusMessage = ref('Crea una visita para generar el QR dinámico desde el backend.')
const copyMessage = ref('')
const rendering = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const createdVisit = ref<CreatedVisit | null>(null)

let refreshTimer: number | undefined
let renderVersion = 0

const hasActiveVisit = computed(() => Boolean(visitId.value.trim() && qrSecret.value.trim()))

const nextRefreshInSeconds = computed(() => {
  if (!hasActiveVisit.value) {
    return 0
  }

  const stepLengthMs = QR_TIME_STEP_SECONDS * 1000
  const elapsed = currentTimestamp.value % stepLengthMs

  return Math.max(0, Math.ceil((stepLengthMs - elapsed) / 1000))
})

const currentStep = computed(() => {
  if (!hasActiveVisit.value) {
    return 0
  }

  return Math.floor(currentTimestamp.value / (QR_TIME_STEP_SECONDS * 1000))
})

const skewWindowLabel = computed(() => `${QR_ALLOWED_SKEW_STEPS * 2 + 1} pasos`)

const visitPayload = computed(() => {
  if (!hasActiveVisit.value) {
    return ''
  }

  return qrToken.value
})

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  }).format(value)
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, '')
}

function clearQrPreview(message: string) {
  qrToken.value = ''
  qrImage.value = ''
  otpCode.value = ''
  statusMessage.value = message
}

async function renderQr() {
  if (!hasActiveVisit.value) {
    clearQrPreview('Crea una visita para generar el QR dinámico desde el backend.')
    return
  }

  const sequence = ++renderVersion
  rendering.value = true
  copyMessage.value = ''

  try {
    const trimmedVisitId = visitId.value.trim()
    const trimmedSecret = qrSecret.value.trim()

    const timestamp = currentTimestamp.value
    const code = await createVisitQrCode(trimmedSecret, timestamp)
    const token = buildVisitQrToken({ visitId: trimmedVisitId, timestamp, code })
    const image = await QRCode.toDataURL(token, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#10131a',
        light: '#ffffff',
      },
    })

    if (sequence !== renderVersion) {
      return
    }

    qrToken.value = token
    qrImage.value = image
    otpCode.value = code
    statusMessage.value = 'QR activo. El código se renueva con el timestamp del cliente.'
  } catch (error) {
    if (sequence !== renderVersion) {
      return
    }

    const message = error instanceof Error ? error.message : 'No se pudo generar el QR.'
    clearQrPreview(message)
  } finally {
    if (sequence === renderVersion) {
      rendering.value = false
    }
  }
}

async function submitVisit() {
  isSubmitting.value = true
  errorMessage.value = ''
  copyMessage.value = ''

  try {
    const client = axios.create({
      baseURL: normalizeBaseUrl(apiBaseUrl.value) || 'http://localhost:3000',
    })

    const headers: Record<string, string> = {}
    const bearerToken = authToken.value.trim()
    const tenantResidentialId = residentialId.value.trim()

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`
    }

    if (tenantResidentialId) {
      headers['x-residential-id'] = tenantResidentialId
    }

    const payload = {
      visitorName: visitorName.value.trim(),
      residentId: residentId.value.trim(),
      visitType: visitType.value,
      startTime: startTime.value.trim() || undefined,
      endTime: endTime.value.trim() || undefined,
    }

    const response = await client.post<CreatedVisit>('/visits', payload, { headers })
    createdVisit.value = response.data
    visitId.value = response.data.id
    qrSecret.value = response.data.qrSecret
    currentTimestamp.value = Date.now()
    statusMessage.value = 'Visita creada en el backend. El QR se generó a partir del secreto recibido.'
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? (error.response?.data?.message ?? error.message)
      : error instanceof Error
        ? error.message
        : 'No se pudo crear la visita.'
    errorMessage.value = Array.isArray(message) ? message.join(', ') : String(message)
    clearQrPreview(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  copyMessage.value = `${label} copiado.`
}

function refreshNow() {
  if (hasActiveVisit.value) {
    currentTimestamp.value = Date.now()
  }
}

watch([visitId, qrSecret, currentTimestamp], () => {
  if (!hasActiveVisit.value) {
    clearQrPreview('Crea una visita para generar el QR dinámico desde el backend.')
    return
  }

  void renderQr()
}, { immediate: true })

onMounted(() => {
  refreshTimer = window.setInterval(refreshNow, 1000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">Visitas / QR dinámico</p>
        <h1>QR por visita conectado al backend</h1>
        <p class="lede">
          Crea una visita real, recibe un secreto por visita y genera un QR temporal con ventana
          de 30 segundos y tolerancia de skew en el cliente.
        </p>

        <div class="stat-row">
          <span class="stat-chip">Cadencia: {{ QR_TIME_STEP_SECONDS }}s</span>
          <span class="stat-chip">Skew: {{ skewWindowLabel }}</span>
          <span class="stat-chip">Paso actual: {{ currentStep }}</span>
        </div>

        <div class="status-line" :data-state="rendering || isSubmitting ? 'active' : 'idle'">
          <span>{{ errorMessage || statusMessage }}</span>
          <span class="status-dot" />
        </div>
        <p v-if="copyMessage" class="lede">{{ copyMessage }}</p>
      </div>

      <div class="qr-panel">
        <div class="qr-frame">
          <img v-if="qrImage" :src="qrImage" alt="QR dinámico de la visita" class="qr-image" />
          <div v-else class="qr-placeholder">
            <span>QR</span>
            <small>sin visita</small>
          </div>
        </div>

        <div class="qr-meta">
          <strong>{{ otpCode || '------' }}</strong>
          <span>Renueva en {{ nextRefreshInSeconds }}s · {{ formatDateTime(currentTimestamp) }}</span>
        </div>
      </div>
    </section>

    <section class="control-grid">
      <article class="control-card">
        <div class="card-heading">
          <p>Crear visita</p>
          <h2>Contratos que llegan al backend</h2>
        </div>

        <label class="field">
          <span>API base URL</span>
          <input v-model="apiBaseUrl" type="text" spellcheck="false" />
        </label>

        <label class="field">
          <span>JWT del residente</span>
          <textarea v-model="authToken" rows="3" spellcheck="false" placeholder="Bearer token opcional" />
        </label>

        <label class="field">
          <span>Residential ID</span>
          <input v-model="residentialId" type="text" spellcheck="false" placeholder="Opcional si ya viene en el JWT" />
        </label>

        <label class="field">
          <span>Visitor name</span>
          <input v-model="visitorName" type="text" spellcheck="false" />
        </label>

        <label class="field">
          <span>Resident ID</span>
          <input v-model="residentId" type="text" spellcheck="false" />
        </label>

        <label class="field">
          <span>Visit type</span>
          <select v-model="visitType">
            <option value="SINGLE_ACCESS">SINGLE_ACCESS</option>
            <option value="RECURRENT">RECURRENT</option>
            <option value="PERMANENT">PERMANENT</option>
          </select>
        </label>

        <div class="mini-grid">
          <label class="field">
            <span>Start time</span>
            <input v-model="startTime" type="time" />
          </label>

          <label class="field">
            <span>End time</span>
            <input v-model="endTime" type="time" />
          </label>
        </div>

        <div class="button-row">
          <button type="button" class="primary" :disabled="isSubmitting" @click="submitVisit">
            {{ isSubmitting ? 'Creando...' : 'Crear visita y QR' }}
          </button>
        </div>
      </article>

      <article class="control-card">
        <div class="card-heading">
          <p>Respuesta del backend</p>
          <h2>Secreto y payload listo para escanear</h2>
        </div>

        <div class="summary-grid">
          <div>
            <span class="summary-label">Visit ID</span>
            <strong>{{ createdVisit?.id || '—' }}</strong>
          </div>
          <div>
            <span class="summary-label">Estado</span>
            <strong>{{ createdVisit?.status || '—' }}</strong>
          </div>
          <div>
            <span class="summary-label">Expira</span>
            <strong>{{ createdVisit ? formatDateTime(new Date(createdVisit.expiresAt).getTime()) : '—' }}</strong>
          </div>
          <div>
            <span class="summary-label">Secret</span>
            <strong>{{ qrSecret ? 'Disponible' : '—' }}</strong>
          </div>
        </div>

        <label class="field">
          <span>Secret por visita</span>
          <textarea :value="qrSecret" rows="3" readonly spellcheck="false" />
        </label>

        <label class="field">
          <span>Token codificado</span>
          <textarea :value="visitPayload" rows="5" readonly spellcheck="false" />
        </label>

        <div class="button-row">
          <button type="button" class="secondary" :disabled="!qrSecret" @click="copyText(qrSecret, 'Secreto')">
            Copiar secreto
          </button>
          <button type="button" class="ghost" :disabled="!visitPayload" @click="copyText(visitPayload, 'Payload')">
            Copiar payload
          </button>
        </div>
      </article>
    </section>
  </main>
</template>
