import { geminiClient } from '../lib/gemini-client.js'
import { driveClient } from '../lib/drive-client.js'
import './settings-modal.js'

class AppCreator extends HTMLElement {
  constructor() {
    super()
    this.messages = []
    this.loading = false
    this.generatedCode = null
    this.showPreview = false
    this.showManualInput = false
    this.manualCode = ''
  }

  connectedCallback() {
    // Start with Gemini's greeting
    this.messages = [{
      role: 'assistant',
      text: "Hi! I'll help you create a simple app. What would you like to build?\n\nFor example:\n- A todo list\n- A habit tracker\n- A simple calculator\n- A note-taking app"
    }]
    this.render()
  }

  async handleSend() {
    const input = this.querySelector('.chat-input')
    const text = input?.value?.trim()
    if (!text || this.loading) return

    // Check for API key
    if (!geminiClient.hasApiKey()) {
      const modal = this.querySelector('settings-modal')
      if (modal) modal.open()
      return
    }

    // Add user message
    this.messages.push({ role: 'user', text })
    input.value = ''
    this.loading = true
    this.render()

    try {
      // Send to Gemini
      const response = await geminiClient.chat(this.messages)
      this.messages.push({ role: 'assistant', text: response })

      // Check if code was generated
      const code = geminiClient.extractCode(response)
      if (code) {
        this.generatedCode = code
        this.showPreview = true
      }
    } catch (err) {
      this.messages.push({
        role: 'assistant',
        text: `Sorry, there was an error: ${err.message}`
      })
    }

    this.loading = false
    this.render()
    this.scrollToBottom()
  }

  async handleCreateApp() {
    const code = this.showManualInput ? this.manualCode : this.generatedCode
    if (!code) return

    const name = this.querySelector('.app-name-input')?.value?.trim()
    if (!name) {
      alert('Please enter an app name')
      return
    }

    this.loading = true
    this.render()

    try {
      const app = await driveClient.createApp(name, code)
      window.location.hash = `#/app/${app.id}`
    } catch (err) {
      alert('Failed to create app: ' + err.message)
      this.loading = false
      this.render()
    }
  }

  handleStartOver() {
    this.messages = [{
      role: 'assistant',
      text: "Let's start fresh! What kind of app would you like to create?"
    }]
    this.generatedCode = null
    this.showPreview = false
    this.render()
  }

  handleKeepRefining() {
    this.showPreview = false
    this.render()
  }

  handleManualMode() {
    this.showManualInput = true
    this.showPreview = false
    this.render()
  }

  handleBackToChat() {
    this.showManualInput = false
    this.render()
  }

  handleManualInput(value) {
    this.manualCode = value
    // Check if it looks like valid HTML
    if (value.includes('<html') || value.includes('<!DOCTYPE')) {
      this.generatedCode = value
    }
  }

  handleBack() {
    window.location.hash = '#/'
  }

  openSettings() {
    const modal = this.querySelector('settings-modal')
    if (modal) modal.open()
  }

  scrollToBottom() {
    const messages = this.querySelector('.chat-messages')
    if (messages) {
      messages.scrollTop = messages.scrollHeight
    }
  }

  bindEvents() {
    const sendBtn = this.querySelector('[data-action="send"]')
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSend())
    }

    const input = this.querySelector('.chat-input')
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          this.handleSend()
        }
      })
      // Focus input
      setTimeout(() => input.focus(), 100)
    }

    const createBtn = this.querySelector('[data-action="create"]')
    if (createBtn) {
      createBtn.addEventListener('click', () => this.handleCreateApp())
    }

    const refineBtn = this.querySelector('[data-action="refine"]')
    if (refineBtn) {
      refineBtn.addEventListener('click', () => this.handleKeepRefining())
    }

    const startOverBtn = this.querySelector('[data-action="start-over"]')
    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => this.handleStartOver())
    }

    const manualBtn = this.querySelector('[data-action="manual"]')
    if (manualBtn) {
      manualBtn.addEventListener('click', () => this.handleManualMode())
    }

    const backToChatBtn = this.querySelector('[data-action="back-to-chat"]')
    if (backToChatBtn) {
      backToChatBtn.addEventListener('click', () => this.handleBackToChat())
    }

    const manualTextarea = this.querySelector('.manual-input')
    if (manualTextarea) {
      manualTextarea.addEventListener('input', (e) => this.handleManualInput(e.target.value))
    }

    const backBtn = this.querySelector('[data-action="back"]')
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBack())
    }

    const settingsBtn = this.querySelector('[data-action="settings"]')
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings())
    }
  }

  formatMessage(text) {
    // Simple formatting: convert code blocks to styled spans
    return text
      .replace(/```html[\s\S]*?```/g, '<span class="code-block">[Generated App Code]</span>')
      .replace(/```[\s\S]*?```/g, '<span class="code-inline">$&</span>')
      .replace(/\n/g, '<br>')
  }

  render() {
    const hasKey = geminiClient.hasApiKey()

    this.innerHTML = `
      <div class="creator">
        <header class="creator-header">
          <button class="secondary" data-action="back">← Back</button>
          <h2>Create New App</h2>
          <button class="icon-btn" data-action="settings" title="Settings">⚙️</button>
        </header>

        ${!hasKey ? `
          <div class="no-key-banner">
            <p>To use AI app generation, please add your Gemini API key in settings.</p>
            <button data-action="settings">Open Settings</button>
            <button class="secondary" data-action="manual">Or paste code manually</button>
          </div>
        ` : ''}

        ${this.showManualInput ? `
          <div class="manual-mode">
            <div class="manual-header">
              <button class="secondary" data-action="back-to-chat">← Back to AI Chat</button>
              <h3>Paste Your App Code</h3>
            </div>
            <textarea class="manual-input" placeholder="Paste your HTML app code here...">${this.escapeHtml(this.manualCode)}</textarea>
            ${this.generatedCode ? `
              <div class="create-section">
                <input type="text" class="app-name-input" placeholder="App name">
                <button data-action="create" ${this.loading ? 'disabled' : ''}>
                  ${this.loading ? 'Creating...' : 'Create App'}
                </button>
              </div>
            ` : ''}
          </div>
        ` : this.showPreview ? `
          <div class="preview-mode">
            <div class="preview-container">
              <h3>Preview</h3>
              <iframe
                class="preview-iframe"
                sandbox="allow-scripts"
                srcdoc="${this.escapeAttr(this.generatedCode || '')}"
              ></iframe>
            </div>
            <div class="preview-actions">
              <input type="text" class="app-name-input" placeholder="App name">
              <div class="button-row">
                <button data-action="create" ${this.loading ? 'disabled' : ''}>
                  ${this.loading ? 'Creating...' : 'Create App'}
                </button>
                <button class="secondary" data-action="refine">Keep Refining</button>
                <button class="secondary" data-action="start-over">Start Over</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="chat-container">
            <div class="chat-messages">
              ${this.messages.map(msg => `
                <div class="message ${msg.role}">
                  <div class="message-content">${this.formatMessage(msg.text)}</div>
                </div>
              `).join('')}
              ${this.loading ? `
                <div class="message assistant">
                  <div class="message-content typing">Thinking...</div>
                </div>
              ` : ''}
            </div>
            <div class="chat-input-row">
              <textarea
                class="chat-input"
                placeholder="Describe what you want to build..."
                rows="2"
              ></textarea>
              <button data-action="send" ${this.loading ? 'disabled' : ''}>Send</button>
            </div>
            <div class="chat-options">
              <button class="link-btn" data-action="manual">Paste code manually instead</button>
            </div>
          </div>
        `}

        <settings-modal></settings-modal>
      </div>

      <style>
        .creator {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f5f5f5;
        }

        .creator-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .creator-header h2 {
          flex: 1;
          margin: 0;
          font-size: 18px;
        }

        .icon-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
        }

        /* No key banner */
        .no-key-banner {
          padding: 20px;
          background: #fff3cd;
          text-align: center;
        }

        .no-key-banner p {
          margin: 0 0 12px 0;
        }

        .no-key-banner button {
          margin: 0 8px;
        }

        /* Chat mode */
        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          padding: 16px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 0;
        }

        .message {
          margin-bottom: 16px;
          display: flex;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
          line-height: 1.5;
        }

        .message.user .message-content {
          background: #4285f4;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message.assistant .message-content {
          background: white;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .typing {
          color: #666;
          font-style: italic;
        }

        .code-block {
          display: block;
          background: #e8f5e9;
          color: #2e7d32;
          padding: 8px 12px;
          border-radius: 6px;
          margin: 8px 0;
          font-family: monospace;
        }

        .chat-input-row {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .chat-input {
          flex: 1;
          border: none;
          resize: none;
          font-size: 16px;
          font-family: inherit;
          outline: none;
        }

        .chat-options {
          text-align: center;
          padding: 12px;
        }

        .link-btn {
          background: none;
          border: none;
          color: #666;
          text-decoration: underline;
          cursor: pointer;
          font-size: 14px;
        }

        /* Preview mode */
        .preview-mode {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .preview-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .preview-container h3 {
          margin: 0;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          font-size: 14px;
          color: #666;
        }

        .preview-iframe {
          flex: 1;
          border: none;
          background: white;
        }

        .preview-actions {
          padding: 16px 0;
        }

        .app-name-input {
          width: 100%;
          padding: 12px;
          font-size: 16px;
          margin-bottom: 12px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Manual mode */
        .manual-mode {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .manual-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .manual-header h3 {
          margin: 0;
        }

        .manual-input {
          flex: 1;
          padding: 16px;
          font-family: monospace;
          font-size: 14px;
          border: 1px solid #ddd;
          border-radius: 8px;
          resize: none;
        }

        .create-section {
          padding: 16px 0;
        }
      </style>
    `

    this.bindEvents()
    this.scrollToBottom()
  }

  escapeHtml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  escapeAttr(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
  }
}

customElements.define('app-creator', AppCreator)
