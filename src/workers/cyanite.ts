// Cyanite webhook handler

import type { Env } from './types'
import { jsonResponse, errorResponse } from './utils'

type CyaniteWebhookPayload = {
  version?: string
  event?: {
    type?: string
    status?: string
  }
  resource?: {
    type?: string
    id?: string
  }
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim()
  if (!trimmed) return ''
  const parts = trimmed.split('=')
  return (parts.length > 1 ? parts[parts.length - 1] : trimmed).trim().toLowerCase()
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function signPayload(secret: string, payload: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, payload)
  return bufferToHex(signature)
}

export async function handleCyaniteWebhook(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const signatureHeader = req.headers.get('Signature') || ''
  const signature = normalizeSignature(signatureHeader)
  const rawBody = await req.arrayBuffer()

  if (env.CYANITE_WEBHOOK_SECRET && signature) {
    const expected = await signPayload(env.CYANITE_WEBHOOK_SECRET, rawBody)
    if (!timingSafeEqual(signature, expected)) {
      return errorResponse('invalid signature', corsHeaders, 401)
    }
  }

  let payload: CyaniteWebhookPayload | null = null
  if (rawBody.byteLength > 0) {
    const text = textDecoder.decode(rawBody)
    try {
      payload = JSON.parse(text) as CyaniteWebhookPayload
    } catch {
      return errorResponse('invalid json', corsHeaders, 400)
    }
  }

  const eventType = payload?.event?.type || null
  const eventStatus = payload?.event?.status || null
  const resourceType = payload?.resource?.type || null
  const resourceId = payload?.resource?.id || null

  return jsonResponse(
    {
      ok: true,
      verified: !!(env.CYANITE_WEBHOOK_SECRET && signature),
      eventType,
      eventStatus,
      resourceType,
      resourceId,
    },
    corsHeaders
  )
}
