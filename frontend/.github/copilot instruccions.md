# COPILOT FRONTEND — Vue Residential Access System

## STACK
- Vue 3 + Vite
- Pinia (only if needed)
- Vue Router
- Axios

---

## 🪨 MODE: CAVEMAN

- Keep components SIMPLE
- No overengineering
- No deep component trees
- One purpose per component
- Direct API calls via services

---

## 🧠 STRUCTURE

- views = pages
- components = reusable UI
- services = API calls (axios)
- store = only if necessary (Pinia)

---

## 🌐 API RULES

- Always use backend services layer
- Never hardcode URLs
- Handle errors simply

---

## 🔐 AUTH FLOW

- Login → JWT stored
- Protect routes via router guards
- No complex state management unless needed

---

## 📱 UI PRINCIPLE

- Simple UI (especially guard panel)
- Mobile-first
- Fast interactions
- Minimal clicks per action

---

## 🔄 QR FLOW

- Receive QR from backend
- Display QR image
- Scan QR (guard flow)
- Send token to backend for validation

---

## 🚀 MVP PRIORITY

1. Login
2. Dashboard
3. Create visit
4. Show QR
5. Guard scan view

---

## ⚡ PRINCIPLE

Simple UI > Fancy UI  
Fast flow > Perfect design  