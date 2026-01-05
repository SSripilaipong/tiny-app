class SessionManager extends HTMLElement {
  constructor() {
    super()
    this.sessions = []
    this.currentSessionId = null
  }

  static get observedAttributes() {
    return ['sessions', 'current-session-id']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'sessions') {
      try {
        this.sessions = JSON.parse(newValue) || []
      } catch {
        this.sessions = []
      }
    } else if (name === 'current-session-id') {
      this.currentSessionId = newValue
    }
    this.render()
  }

  connectedCallback() {
    try {
      this.sessions = JSON.parse(this.getAttribute('sessions') || '[]')
    } catch {
      this.sessions = []
    }
    this.currentSessionId = this.getAttribute('current-session-id')
    this.render()
  }

  handleSessionChange(sessionId) {
    this.dispatchEvent(new CustomEvent('session-change', {
      detail: { sessionId },
      bubbles: true
    }))
  }

  handleNewSession() {
    this.dispatchEvent(new CustomEvent('new-session', {
      bubbles: true
    }))
  }

  bindEvents() {
    const select = this.querySelector('.session-select')
    if (select) {
      select.addEventListener('change', (e) => this.handleSessionChange(e.target.value))
    }

    const newBtn = this.querySelector('[data-action="new-session"]')
    if (newBtn) {
      newBtn.addEventListener('click', () => this.handleNewSession())
    }
  }

  render() {
    this.innerHTML = `
      <div class="session-manager">
        <select class="session-select">
          ${this.sessions.map(s => `
            <option value="${s.id}" ${s.id === this.currentSessionId ? 'selected' : ''}>
              ${this.escapeHtml(s.name)}
            </option>
          `).join('')}
        </select>
        <button class="new-session-btn" data-action="new-session" title="New session">+</button>
      </div>

      <style>
        .session-manager {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .session-select {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
          min-width: 120px;
        }

        .new-session-btn {
          padding: 6px 10px;
          font-size: 16px;
          font-weight: bold;
        }
      </style>
    `

    this.bindEvents()
  }

  escapeHtml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

customElements.define('session-manager', SessionManager)
