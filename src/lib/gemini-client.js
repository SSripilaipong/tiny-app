const STORAGE_KEY = 'tiny_app_gemini_key'
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const SYSTEM_PROMPT = `You are an app builder assistant for tiny-app.dev. Help users create simple single-file HTML apps through conversation.

YOUR ROLE:
1. First, understand what the user wants to build
2. Ask 1-2 clarifying questions if needed (keep it simple, non-technical)
3. When ready, generate the complete HTML app

WHEN ASKING QUESTIONS, be friendly and simple:
- "What information do you want to save between visits?"
- "Should it have any buttons? What should they do?"
- "Is this for tracking something, calculating something, or something else?"

WHEN GENERATING CODE:
- Wrap the complete HTML in \`\`\`html and \`\`\` markers
- Include all CSS in <style> tags
- Include all JS in <script> tags
- Keep it simple and focused
- Make it mobile-friendly

TINY-APP.DEV MESSAGE PROTOCOL (you MUST include this in generated apps):

// On load - receive saved data
window.addEventListener('message', (e) => {
  if (e.data.type === 'init') {
    const saved = e.data.session; // previously saved data
    // Use 'saved' to restore app state
  }
  if (e.data.type === 'session-saved') {
    // Save completed: e.data.success is true/false
  }
});
window.parent.postMessage({ type: 'ready' }, '*');

// To save data (call this when user makes changes)
window.parent.postMessage({
  type: 'update-session',
  data: { /* your data object to persist */ }
}, '*');

Keep apps simple. Users are non-technical. Always include the message protocol code.`

class GeminiClient {
  setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  getApiKey() {
    return localStorage.getItem(STORAGE_KEY)
  }

  hasApiKey() {
    return !!this.getApiKey()
  }

  clearApiKey() {
    localStorage.removeItem(STORAGE_KEY)
  }

  /**
   * Send a chat conversation to Gemini
   * @param {Array} messages - Array of {role: 'user'|'model', text: string}
   * @returns {Promise<string>} - The assistant's response text
   */
  async chat(messages) {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('No API key set. Please add your Gemini API key in settings.')
    }

    // Build contents array with system instruction
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.text }]
    }))

    const response = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('No response from Gemini')
    }

    return text
  }

  /**
   * Extract HTML code from a Gemini response
   * @param {string} response - The full response text
   * @returns {string|null} - The extracted HTML or null if not found
   */
  extractCode(response) {
    // Look for ```html ... ``` blocks
    const htmlMatch = response.match(/```html\s*([\s\S]*?)```/)
    if (htmlMatch) {
      return htmlMatch[1].trim()
    }

    // Fallback: look for <!DOCTYPE or <html
    if (response.includes('<!DOCTYPE') || response.includes('<html')) {
      // Try to extract the HTML portion
      const start = response.indexOf('<!DOCTYPE') !== -1
        ? response.indexOf('<!DOCTYPE')
        : response.indexOf('<html')
      const end = response.lastIndexOf('</html>') + 7
      if (end > start) {
        return response.slice(start, end).trim()
      }
    }

    return null
  }

  /**
   * Check if a response contains generated code
   * @param {string} response - The response text
   * @returns {boolean}
   */
  hasCode(response) {
    return this.extractCode(response) !== null
  }
}

export const geminiClient = new GeminiClient()
