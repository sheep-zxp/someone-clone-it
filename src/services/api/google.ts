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

type GoogleUsage = {
  prompt_tokens?: number
  completion_tokens?: number
}

type GoogleChunk = {
  id?: string
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
  usage?: GoogleUsage
}

function getGoogleBaseUrl(): string {
  const fromEnv = process.env.GOOGLE_BASE_URL || process.env.GOOGLE_OPENAI_BASE_URL
  const raw = (fromEnv || 'https://generativelanguage.googleapis.com/v1beta/openai').trim()
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function getGoogleKey(): string | null {
  return process.env.GOOGLE_API_KEY || null
}

function toChatMessages(messages: Message[], systemPrompt: SystemPrompt) {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
    []
  const systemText = systemPrompt.join('\n\n').trim()
  if (systemText) out.push({ role: 'system', content: systemText })

  for (const message of messages) {
    if (message.type === 'user') {
      const text = getUserMessageText(message)?.trim()
      if (text) out.push({ role: 'user', content: text })
      continue
    }
    if (message.type === 'assistant') {
      const text = getAssistantMessageText(message)?.trim()
      if (text) out.push({ role: 'assistant', content: text })
    }
  }
  return out
}

function mapFinishReason(reason: string | null | undefined): string {
  if (reason === 'length') return 'max_tokens'
  if (reason === 'tool_calls') return 'tool_use'
  if (reason === 'content_filter') return 'refusal'
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

  const url = `${getGoogleBaseUrl()}/chat/completions`
  const requestBody = {
    model,
    messages: toChatMessages(messages, systemPrompt),
    stream: true,
    stream_options: { include_usage: true },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-goog-api-key': apiKey,
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

  if (!response.ok || !response.body) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const text = await response.text()
      if (text) detail = `${detail} - ${text}`
    } catch {}
    yield createAssistantAPIErrorMessage({
      content: `${API_ERROR_MESSAGE_PREFIX}: ${detail}`,
      apiError: 'unknown_error',
      error: 'unknown_error',
    })
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let requestId = randomUUID()
  let finishReason: string | null | undefined = null
  let usage: GoogleUsage | undefined
  let hasStarted = false
  const startedAt = Date.now()

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

  const reader = response.body.getReader()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
      if (dataLines.length === 0) continue
      const data = dataLines.join('\n')
      if (data === '[DONE]') continue

      let chunk: GoogleChunk | null = null
      try {
        chunk = JSON.parse(data) as GoogleChunk
      } catch {
        logForDebugging(`[Google] Failed to parse SSE chunk: ${data}`)
      }
      if (!chunk) continue

      if (chunk.id) requestId = chunk.id
      if (chunk.usage) usage = chunk.usage

      const choice = chunk.choices?.[0]
      if (!choice) continue
      if (choice.finish_reason !== undefined) finishReason = choice.finish_reason

      const deltaText = choice.delta?.content ?? ''
      if (!deltaText) continue
      content += deltaText
      const ttftMs = !hasStarted ? Date.now() - startedAt : undefined
      hasStarted = true
      yield createStreamEvent(
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: deltaText },
        },
        ttftMs,
      )
    }
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
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
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
