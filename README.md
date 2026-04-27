# 🏘️ Residential Access Control System (QR-Based)

## 📌 Descripción General

Este proyecto es una plataforma SaaS para la gestión de accesos en residenciales mediante códigos QR. Permite a residentes generar accesos temporales para visitantes, mientras que los guardias validan dichos accesos en tiempo real.

El sistema está diseñado para entornos con conectividad variable (como LATAM), priorizando:
- Seguridad
- Simplicidad de uso
- Escalabilidad
- Resiliencia (offline-first donde sea posible)

---

# 🎯 Objetivos del Sistema

- Eliminar registros manuales (cuadernos)
- Mejorar control y trazabilidad de visitas
- Reducir errores humanos
- Proveer auditoría completa de accesos
- Permitir integración futura con hardware (portones, cámaras, etc.)

---

# 🧱 Arquitectura General

## 🔹 Tipo de arquitectura
- Monorepo (frontend + backend)
- Backend basado en arquitectura modular
- Separación clara de responsabilidades (SOLID)

## 🔹 Componentes

- Frontend: Vue 3 (SPA / PWA-ready)
- Backend: NestJS (API REST + WebSockets)
- Base de datos: PostgreSQL
- ORM: Prisma
- Autenticación: JWT
- Tiempo real: WebSockets (NestJS Gateway)

---

# 📂 Estructura del Proyecto
residential-access/
│
├── backend/
│ ├── src/
│ │ ├── modules/
│ │ ├── common/
│ │ ├── config/
│ │ ├── database/
│ │ └── main.ts
│ └── prisma/
│
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ ├── views/
│ │ ├── router/
│ │ ├── store/
│ │ └── services/
│
└── docs/
---

# 🔐 Seguridad (CRÍTICO)

## Autenticación
- JWT con expiración corta
- Refresh tokens opcionales
- Hash de contraseñas con bcrypt

## Autorización
- Role-based access control (RBAC)
- Roles:
  - ADMIN
  - RESIDENT
  - GUARD

## QR Security
- Nunca usar IDs directos
- Usar tokens firmados (JWT o UUID + firma)
- Expiración obligatoria
- Opción de un solo uso

## Validaciones
- Validación estricta con DTOs (class-validator)
- Sanitización de inputs

## Protección adicional
- Rate limiting
- CORS configurado
- Helmet (seguridad HTTP headers)
- Logs de auditoría

---

# 🧠 Principios de Diseño

## SOLID

- S: Cada módulo tiene una responsabilidad única
- O: Código abierto a extensión, cerrado a modificación
- L: Interfaces claras para servicios
- I: Interfaces pequeñas y específicas
- D: Inyección de dependencias (NestJS)

---

## Clean Code

- Nombres descriptivos (no abreviaciones ambiguas)
- Funciones pequeñas (< 30 líneas)
- Evitar lógica en controladores
- Uso de services para lógica de negocio
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)

---

## Escalabilidad

- Arquitectura modular
- Preparado para multi-tenant (varios residenciales)
- Separación de capas:
  - Controller
  - Service
  - Repository (Prisma)
- Uso de DTOs y validaciones centralizadas

---

# 🧩 Módulos del Backend

## Auth Module
- Login
- Registro
- Generación de JWT
- Guards de autenticación

## Users Module
- Gestión de usuarios
- Roles
- Relación con casas

## Houses Module
- Gestión de propiedades
- Relación con residentes

## Visits Module (CORE)
- Crear visitas
- Fechas y estados
- Asociación con usuario

## QR Module
- Generación de QR
- Validación de tokens
- Expiración

## Guards Module
- Registro de accesos
- Logs de entrada/salida

---

# 🗄️ Modelo de Datos (Resumen)

## User
- id
- name
- email
- password (hashed)
- role

## House
- id
- number
- ownerId

## Visit
- id
- visitorName
- date
- status
- qrToken
- expiresAt
- used

## AccessLog
- id
- visitId
- guardId
- timestamp
- type (ENTRY/EXIT)

---

# 🔄 Flujo del Sistema

## Generación de acceso
1. Residente crea visita
2. Backend genera token seguro
3. Se genera QR
4. Se envía al residente

## Validación
1. Guardia escanea QR
2. Backend valida token
3. Verifica:
   - expiración
   - estado
   - uso previo
4. Registra acceso

---

# 📡 Comunicación

## API REST
- CRUD de entidades
- Autenticación

## WebSockets
- Notificaciones en tiempo real
- Eventos:
  - nueva visita
  - acceso registrado

---

# 🎨 Frontend

## Principios
- UI simple (especialmente para guardias)
- Mobile-first
- UX clara y directa

## Estado global
- Pinia

## Comunicación
- Axios

## Rutas protegidas
- Middleware de autenticación

---

# 📱 Preparación para App

## PWA
- Instalable
- Offline caching básico

## Futuro
- Capacitor para app nativa

---

# ⚠️ Consideraciones especiales (LATAM)

- Conectividad intermitente
- Usuarios no técnicos
- Uso intensivo de WhatsApp

## Requisitos clave
- UI extremadamente simple
- Manejo de errores claro
- Soporte offline parcial

---

# 🧪 Testing

## Backend
- Unit tests (Jest)
- Integration tests

## Buenas prácticas
- Mock de servicios
- Test de endpoints críticos

---

# 🚀 Deployment

## Backend
- Docker recomendado
- Variables de entorno (.env)

## Frontend
- Build optimizado
- Hosting en CDN

---

# 📊 Logging y monitoreo

- Logs estructurados
- Auditoría de accesos
- Manejo de errores centralizado

---

# 🧠 Reglas para desarrollo (IMPORTANTE)

- No mezclar lógica de negocio en controllers
- No acceder directamente a DB fuera de services
- Validar SIEMPRE inputs
- No exponer datos sensibles
- Usar async/await correctamente
- Manejar errores globalmente

---

# 📌 Roadmap

## MVP
- Auth
- Crear visitas
- Generar QR
- Validar QR

## Fase 2
- Notificaciones
- Historial

## Fase 3
- Integración con hardware
- Reconocimiento de placas

---

# 🏁 Conclusión

Este proyecto debe construirse como un sistema profesional desde el inicio, priorizando:
- Seguridad
- Escalabilidad
- Simplicidad de uso

No es solo una app, es una plataforma SaaS lista para crecer.