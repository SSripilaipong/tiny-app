import { geminiClient } from '../lib/gemini-client.js'

class SettingsModal extends HTMLElement {
  constructor() {
    super()
    this.isOpen = false
  }

  connectedCallback() {
    this.render()
  }

  open() {
    this.isOpen = true
    this.render()
  }

  close() {
    this.isOpen = false
    this.render()
    this.dispatchEvent(new CustomEvent('close', { bubbles: true }))
  }

  handleSave() {
    const input = this.querySelector('.api-key-input')
    const key = input?.value?.trim()
    if (key) {
      geminiClient.setApiKey(key)
      this.render()
    }
  }

  handleClear() {
    geminiClient.clearApiKey()
    this.render()
  }

  handleBackdropClick(e) {
    if (e.target.classList.contains('modal-backdrop')) {
      this.close()
    }
  }

  bindEvents() {
    const backdrop = this.querySelector('.modal-backdrop')
    if (backdrop) {
      backdrop.addEventListener('click', (e) => this.handleBackdropClick(e))
    }

    const closeBtn = this.querySelector('[data-action="close"]')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    const saveBtn = this.querySelector('[data-action="save"]')
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave())
    }

    const clearBtn = this.querySelector('[data-action="clear"]')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.handleClear())
    }

    const input = this.querySelector('.api-key-input')
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSave()
      })
    }
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****'
    return key.slice(0, 4) + '****' + key.slice(-4)
  }

  render() {
    const hasKey = geminiClient.hasApiKey()
    const maskedKey = hasKey ? this.maskKey(geminiClient.getApiKey()) : ''

    this.innerHTML = `
      ${this.isOpen ? `
        <div class="modal-backdrop">
          <div class="modal">
            <div class="modal-header">
              <h3>Settings</h3>
              <button class="modal-close" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
              <label class="setting-label">Gemini API Key</label>
              ${hasKey ? `
                <div class="key-saved">
                  <span class="key-badge">Key saved: ${maskedKey}</span>
                  <button class="secondary small" data-action="clear">Clear</button>
                </div>
              ` : `
                <div class="key-input-row">
                  <input type="password" class="api-key-input" placeholder="Enter your API key">
                  <button data-action="save">Save</button>
                </div>
              `}
              <p class="setting-help">
                Get your free API key from
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>
              </p>
              <p class="setting-note">
                Your key is stored locally in your browser and only sent to Google's API.
              </p>
            </div>
          </div>
        </div>
      ` : ''}

      <style>
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          line-height: 1;
        }

        .modal-body {
          padding: 20px;
        }

        .setting-label {
          display: block;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .key-input-row {
          display: flex;
          gap: 8px;
        }

        .api-key-input {
          flex: 1;
          padding: 10px 12px;
          font-size: 14px;
        }

        .key-saved {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .key-badge {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
        }

        .small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .setting-help {
          margin-top: 12px;
          font-size: 13px;
          color: #666;
        }

        .setting-help a {
          color: #4285f4;
        }

        .setting-note {
          margin-top: 8px;
          font-size: 12px;
          color: #999;
        }
      </style>
    `

    this.bindEvents()
  }
}

customElements.define('settings-modal', SettingsModal)
