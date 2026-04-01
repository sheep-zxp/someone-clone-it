import { randomUUID } from 'crypto'
import type { SystemPrompt } from 'src/utils/systemPromptType.js'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  createAssistantAPIErrorMessage,
  getAssistantMessageText,
  getUserMessageText,
} from '../../utils/messages.js'
import { API_ERROR_MESSAGE_PREFIX } from './errors.js'

type GooglePart = {
  text?: string
}

type GoogleContent = {
  role?: 'user' | 'model'
  parts?: GooglePart[]
}

type GoogleGenerateResponse = {
  candidates?: Array<{
    content?: GoogleContent
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
  error?: {
    message?: string
  }
}

function getGoogleBaseUrl(): string {
  const fromEnv = process.env.GOOGLE_BASE_URL || process.env.GOOGLE_OPENAI_BASE_URL
  const raw = (fromEnv || 'https://generativelanguage.googleapis.com/v1beta').trim()
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function getGoogleKey(): string | null {
  return process.env.GOOGLE_API_KEY || null
}

function normalizeGoogleModel(model: string): string {
  const trimmed = model.trim()
  return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed
}

function toGoogleContents(messages: Message[], systemPrompt: SystemPrompt) {
  const out: GoogleContent[] = []
  const systemText = systemPrompt.join('\n\n').trim()

  if (systemText) {
    out.push({
      role: 'user',
      parts: [{ text: `[System Instruction]\n${systemText}` }],
    })
  }

  for (const message of messages) {
    if (message.type === 'user') {
      const text = getUserMessageText(message)?.trim()
      if (text) {
        out.push({ role: 'user', parts: [{ text }] })
      }
      continue
    }
    if (message.type === 'assistant') {
      const text = getAssistantMessageText(message)?.trim()
      if (text) {
        out.push({ role: 'model', parts: [{ text }] })
      }
    }
  }

  if (out.length === 0) {
    out.push({ role: 'user', parts: [{ text: 'Hello' }] })
  }

  return out
}

function mapFinishReason(reason: string | null | undefined): string {
  if (reason === 'MAX_TOKENS') return 'max_tokens'
  if (
    reason === 'SAFETY' ||
    reason === 'RECITATION' ||
    reason === 'BLOCKLIST' ||
    reason === 'PROHIBITED_CONTENT'
  ) {
    return 'refusal'
  }
  return 'end_turn'
}

function createStreamEvent(
  event: Record<string, unknown>,
  ttftMs?: number,
): StreamEvent {
  return {
    type: 'stream_event',
    event: event as never,
    ...(ttftMs !== undefined ? { ttftMs } : {}),
  }
}

export async function* queryGoogleWithStreaming({
  messages,
  systemPrompt,
  signal,
  model,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  signal: AbortSignal
  model: string
}): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const apiKey = getGoogleKey()
  if (!apiKey) {
    yield createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: GOOGLE_API_KEY is required when provider=google`,
      apiError: 'invalid_api_key',
      error: 'invalid_api_key',
    })
    return
  }

  const modelId = normalizeGoogleModel(model)
  const url =
    `${getGoogleBaseUrl()}/models/${encodeURIComponent(modelId)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  const startedAt = Date.now()
  const requestBody = {
    contents: toGoogleContents(messages, systemPrompt),
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    })
  } catch (error) {
    yield createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      apiError: 'network_error',
      error: 'network_error',
    })
    return
  }

  let body: GoogleGenerateResponse | null = null
  if (response.ok) {
    try {
      body = (await response.json()) as GoogleGenerateResponse
    } catch {}
  }

  if (!response.ok || !body) {
    let detail = `${response.status} ${response.statusText}`
    const message = body?.error?.message?.trim()
    if (message) detail = `${detail} - ${message}`
    yield createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: ${detail}`,
      apiError: 'unknown_error',
      error: 'unknown_error',
    })
    return
  }

  let requestId = randomUUID()
  const content =
    body.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? '')
      .join('') ?? ''
  const finishReason = body.candidates?.[0]?.finishReason

  yield createStreamEvent({
    type: 'message_start',
    message: {
      id: requestId,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      container: null,
      context_management: null,
    },
  }, 0)

  yield createStreamEvent({
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })

  if (content) {
    yield createStreamEvent(
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: content },
      },
      Date.now() - startedAt,
    )
  } else {
    logForDebugging('[Google] Empty content returned from generateContent')
  }

  const assistantMessage: AssistantMessage = {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    requestId,
    message: {
      id: requestId,
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: content || '' }] as never,
      stop_reason: mapFinishReason(finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: body.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      } as never,
      container: null,
      context_management: null,
    },
  }

  yield assistantMessage
  yield createStreamEvent({ type: 'content_block_stop', index: 0 })
  yield createStreamEvent({
    type: 'message_delta',
    delta: { stop_reason: assistantMessage.message.stop_reason },
    usage: assistantMessage.message.usage,
  })
  yield createStreamEvent({ type: 'message_stop' })
}
