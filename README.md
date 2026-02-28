## Bitespeed Identity Reconciliation API

### 🚀 Overview

This project implements an Identity Reconciliation system as part of the Bitespeed Backend Task.

The system consolidates multiple customer records based on email and phone number using a primary-secondary linking strategy.

---

### 🧠 Problem Statement

When a customer makes purchases using different emails or phone numbers, the system must:

* Identify existing contacts
* Link them correctly
* Maintain a single primary contact
* Convert others to secondary contacts
* Return consolidated contact information

---

### 🏗 Tech Stack

* Node.js
* TypeScript
* Express.js
* Prisma ORM
* PostgreSQL
* pgAdmin (local development)

---

### 🔗 API Endpoint

```
POST /identify
```

---

### 📥 Request Body Example

```json
{
  "email": "doc@fluxkart.com",
  "phoneNumber": "123456"
}
```

---

### 📤 Response Example

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["doc@fluxkart.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

---

### 🧩 Reconciliation Logic

1. If no match → Create primary contact.
2. If match found → Consolidate records.
3. Oldest contact remains primary.
4. Others converted to secondary.
5. All emails & phone numbers returned uniquely.

---

### ▶️ Running Locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

Server runs on:

```
http://localhost:3000
```
