import { driveClient } from '../lib/drive-client.js'
import './session-manager.js'

class AppRunner extends HTMLElement {
  constructor() {
    super()
    this.appId = null
    this.manifest = null
    this.params = null
    this.appHtml = null
    this.sessions = []
    this.currentSession = null
    this.loading = true
    this.saveTimeout = null
    this.iframe = null
    this._mounted = false
  }

  static get observedAttributes() {
    return ['app-id']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'app-id' && newValue !== oldValue) {
      this.appId = newValue
      // Only load if already mounted (attribute changed after mount)
      if (this._mounted) {
        this.loadApp()
      }
    }
  }

  connectedCallback() {
    this._mounted = true
    this.appId = this.getAttribute('app-id')
    if (this.appId) {
      this.loadApp()
    }

    // Listen for messages from iframe
    this.messageHandler = this.handleMessage.bind(this)
    window.addEventListener('message', this.messageHandler)
  }

  disconnectedCallback() {
    window.removeEventListener('message', this.messageHandler)
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
  }

  async loadApp() {
    this.loading = true
    this.render()

    try {
      // Load app files
      const files = await driveClient.getAppFiles(this.appId)
      this.manifest = files.manifest
      this.params = files.params || {}
      this.appHtml = files.appHtml

      // Load sessions
      this.sessions = await driveClient.listSessions(this.appId)

      // Load first session or create default
      if (this.sessions.length > 0) {
        await this.loadSession(this.sessions[0].id)
      } else {
        await this.createSession('Default')
      }
    } catch (err) {
      console.error('Failed to load app:', err)
      alert('Failed to load app: ' + err.message)
    }

    this.loading = false
    this.render()
  }

  async loadSession(sessionId) {
    try {
      const session = await driveClient.getSession(sessionId)
      this.currentSession = { id: sessionId, ...session }
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  async createSession(name) {
    try {
      const session = await driveClient.createSession(this.appId, name)
      this.currentSession = { id: session.id, ...session.data }
      this.sessions = await driveClient.listSessions(this.appId)
      this.render()
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  async handleSessionChange(sessionId) {
    await this.loadSession(sessionId)
    this.sendInitToIframe()
  }

  async handleNewSession() {
    const name = prompt('Session name:')
    if (name) {
      await this.createSession(name)
      this.sendInitToIframe()
    }
  }

  handleMessage(event) {
    // Security: only accept messages from our iframe
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return
    }

    const { type, data } = event.data || {}

    switch (type) {
      case 'ready':
        this.sendInitToIframe()
        break

      case 'update-session':
        this.handleSessionUpdate(data)
        break
    }
  }

  sendInitToIframe() {
    if (!this.iframe?.contentWindow) return

    this.iframe.contentWindow.postMessage({
      type: 'init',
      manifest: this.manifest,
      params: this.params,
      session: this.currentSession?.data || {}
    }, '*')
  }

  handleSessionUpdate(data) {
    if (!this.currentSession) return

    this.currentSession.data = data

    // Save immediately (no debounce)
    this.saveCurrentSession()
  }

  async saveCurrentSession() {
    if (!this.currentSession) return

    try {
      await driveClient.saveSession(this.currentSession.id, {
        name: this.currentSession.name,
        createdAt: this.currentSession.createdAt,
        data: this.currentSession.data
      })
      // Notify iframe that save succeeded
      this.sendMessageToIframe({ type: 'session-saved', success: true })
    } catch (err) {
      console.error('Failed to save session:', err)
      // Notify iframe that save failed
      this.sendMessageToIframe({ type: 'session-saved', success: false, error: err.message })
    }
  }

  sendMessageToIframe(message) {
    if (!this.iframe?.contentWindow) return
    this.iframe.contentWindow.postMessage(message, '*')
  }

  handleBack() {
    window.location.hash = '#/'
  }

  handleEdit() {
    window.location.hash = `#/app/${this.appId}/edit`
  }

  bindEvents() {
    const backBtn = this.querySelector('[data-action="back"]')
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBack())
    }

    const editBtn = this.querySelector('[data-action="edit"]')
    if (editBtn) {
      editBtn.addEventListener('click', () => this.handleEdit())
    }

    // Session manager events
    const sessionManager = this.querySelector('session-manager')
    if (sessionManager) {
      sessionManager.addEventListener('session-change', (e) => {
        this.handleSessionChange(e.detail.sessionId)
      })
      sessionManager.addEventListener('new-session', () => {
        this.handleNewSession()
      })
    }

    // Store reference to iframe
    this.iframe = this.querySelector('.app-iframe')
  }

  render() {
    this.innerHTML = `
      <div class="runner">
        <header class="runner-header">
          <button class="secondary" data-action="back">← Back</button>
          <h2>${this.manifest?.name || 'Loading...'}</h2>
          <div class="header-actions">
            <session-manager
              sessions='${JSON.stringify(this.sessions || [])}'
              current-session-id="${this.currentSession?.id || ''}"
            ></session-manager>
            <button class="secondary" data-action="edit">Edit</button>
          </div>
        </header>

        ${this.loading ? `
          <div class="loading">Loading app...</div>
        ` : `
          <div class="runner-content">
            <iframe
              class="app-iframe"
              sandbox="allow-scripts"
              srcdoc="${this.escapeAttr(this.appHtml || '')}"
            ></iframe>
          </div>
        `}
      </div>

      <style>
        .runner {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .runner-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .runner-header h2 {
          flex: 1;
          margin: 0;
          font-size: 18px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: #666;
        }

        .runner-content {
          flex: 1;
          display: flex;
          background: white;
        }

        .app-iframe {
          flex: 1;
          border: none;
          background: white;
        }
      </style>
    `

    this.bindEvents()
  }

  escapeAttr(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
  }
}

customElements.define('app-runner', AppRunner)
