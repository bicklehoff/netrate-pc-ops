// Anthropic Claude API Client — CoreBot's brain
// Used by: Process Docs engine, document identification, data extraction

import Anthropic from '@anthropic-ai/sdk';

let client = null;

/**
 * Get the Anthropic client singleton.
 * @returns {Anthropic}
 */
export function getAnthropicClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Send a message to Claude and get a text response.
 *
 * @param {object} params
 * @param {string} params.system — system prompt
 * @param {string|Array} params.messages — user message string or full messages array
 * @param {string} [params.model] — model ID (default: claude-sonnet-4-20250514)
 * @param {number} [params.maxTokens] — max tokens (default: 4096)
 * @returns {Promise<string>} — text response
 */
export async function askClaude({ system, messages, model = 'claude-sonnet-4-20250514', maxTokens = 4096 }) {
  const anthropic = getAnthropicClient();

  // Accept a simple string as a single user message
  const messageArray = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: messageArray,
  });

  return response.content[0].text;
}

/**
 * Send a message to Claude with document/image content blocks.
 * Used for PDF and image identification in CoreBot.
 *
 * @param {object} params
 * @param {string} params.system — system prompt
 * @param {Array} params.content — array of content blocks (text, image, document)
 * @param {string} [params.model] — model ID
 * @param {number} [params.maxTokens] — max tokens
 * @returns {Promise<string>} — text response
 */
export async function askClaudeWithDocs({ system, content, model = 'claude-sonnet-4-20250514', maxTokens = 4096 }) {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });

  return response.content[0].text;
}
