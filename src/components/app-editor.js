import { driveClient } from '../lib/drive-client.js'

class AppEditor extends HTMLElement {
  constructor() {
    super()
    this.appId = null
    this.appHtml = ''
    this.manifest = null
    this.loading = true
    this.saving = false
    this.dirty = false
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
  }

  async loadApp() {
    this.loading = true
    this.render()

    try {
      const files = await driveClient.getAppFiles(this.appId)
      this.appHtml = files.appHtml || ''
      this.manifest = files.manifest || { name: 'Untitled', params: {}, sessionSchema: {} }
    } catch (err) {
      console.error('Failed to load app:', err)
      alert('Failed to load app: ' + err.message)
    }

    this.loading = false
    this.dirty = false
    this.render()
  }

  handleInput(value) {
    this.appHtml = value
    this.dirty = true
    this.updateSaveButton()
  }

  updateSaveButton() {
    const btn = this.querySelector('[data-action="save"]')
    if (btn) {
      btn.textContent = this.dirty ? 'Save *' : 'Save'
      btn.disabled = this.saving
    }
  }

  async handleSave() {
    if (this.saving) return

    this.saving = true
    this.updateSaveButton()

    try {
      await driveClient.saveAppHtml(this.appId, this.appHtml)
      this.dirty = false
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }

    this.saving = false
    this.updateSaveButton()
  }

  handleBack() {
    if (this.dirty && !confirm('You have unsaved changes. Leave anyway?')) {
      return
    }
    window.location.hash = '#/'
  }

  handleRun() {
    if (this.dirty && !confirm('You have unsaved changes. Run anyway?')) {
      return
    }
    window.location.hash = `#/app/${this.appId}`
  }

  bindEvents() {
    const backBtn = this.querySelector('[data-action="back"]')
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBack())
    }

    const runBtn = this.querySelector('[data-action="run"]')
    if (runBtn) {
      runBtn.addEventListener('click', () => this.handleRun())
    }

    const saveBtn = this.querySelector('[data-action="save"]')
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave())
    }

    const textarea = this.querySelector('.code-input')
    if (textarea) {
      textarea.addEventListener('input', (e) => this.handleInput(e.target.value))
    }
  }

  render() {
    this.innerHTML = `
      <div class="editor">
        <header class="editor-header">
          <button class="secondary" data-action="back">← Back</button>
          <h2>${this.manifest?.name || 'Loading...'}</h2>
          <div class="header-actions">
            <button class="secondary" data-action="run">Run</button>
            <button data-action="save" ${this.saving ? 'disabled' : ''}>
              ${this.dirty ? 'Save *' : 'Save'}
            </button>
          </div>
        </header>

        ${this.loading ? `
          <div class="loading">Loading app...</div>
        ` : `
          <div class="editor-content">
            <textarea
              class="code-input"
              placeholder="Paste your app HTML here..."
            >${this.escapeHtml(this.appHtml)}</textarea>
          </div>
        `}
      </div>

      <style>
        .editor {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .editor-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .editor-header h2 {
          flex: 1;
          margin: 0;
          font-size: 18px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: #666;
        }

        .editor-content {
          flex: 1;
          display: flex;
          padding: 16px;
          background: #f5f5f5;
        }

        .code-input {
          flex: 1;
          padding: 16px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: none;
          background: white;
        }

        .code-input:focus {
          outline: none;
          border-color: #4285f4;
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

customElements.define('app-editor', AppEditor)
