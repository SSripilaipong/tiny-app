import { googleAuth } from '../lib/google-auth.js'
import { driveClient } from '../lib/drive-client.js'
import './settings-modal.js'

class AppLibrary extends HTMLElement {
  constructor() {
    super()
    this.apps = []
    this.loading = false
  }

  connectedCallback() {
    this.render()

    if (googleAuth.isSignedIn()) {
      this.loadApps()
    }
  }

  async loadApps() {
    this.loading = true
    this.render()

    try {
      this.apps = await driveClient.listApps()
    } catch (err) {
      console.error('Failed to load apps:', err)
      this.apps = []
    }

    this.loading = false
    this.render()
  }

  handleCreateApp() {
    window.location.hash = '#/create'
  }

  openSettings() {
    const modal = this.querySelector('settings-modal')
    if (modal) modal.open()
  }

  async handleDeleteApp(appId, appName) {
    if (!confirm(`Delete "${appName}"? This will move it to Drive trash.`)) {
      return
    }

    try {
      await driveClient.deleteApp(appId)
      this.loadApps()
    } catch (err) {
      alert('Failed to delete app: ' + err.message)
    }
  }

  handleSignIn() {
    googleAuth.signIn()
  }

  handleSignOut() {
    googleAuth.signOut()
    this.apps = []
    this.render()
  }

  formatDate(isoString) {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  bindEvents() {
    // Sign in button
    const signInBtn = this.querySelector('[data-action="sign-in"]')
    if (signInBtn) {
      signInBtn.addEventListener('click', () => this.handleSignIn())
    }

    // Sign out button
    const signOutBtn = this.querySelector('[data-action="sign-out"]')
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this.handleSignOut())
    }

    // Create app button
    const createBtn = this.querySelector('[data-action="create-app"]')
    if (createBtn) {
      createBtn.addEventListener('click', () => this.handleCreateApp())
    }

    // Settings button
    const settingsBtn = this.querySelector('[data-action="settings"]')
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings())
    }

    // Delete buttons
    this.querySelectorAll('[data-action="delete-app"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const appId = btn.dataset.appId
        const appName = btn.dataset.appName
        this.handleDeleteApp(appId, appName)
      })
    })
  }

  render() {
    const isSignedIn = googleAuth.isSignedIn()

    this.innerHTML = `
      <div class="library">
        <header class="library-header">
          <h1>tiny-app.dev</h1>
          <div class="header-actions">
            ${isSignedIn ? `
              <button class="icon-btn" data-action="settings" title="Settings">⚙️</button>
              <button class="secondary" data-action="sign-out">Sign Out</button>
            ` : ''}
          </div>
        </header>

        ${!isSignedIn ? `
          <div class="connect-prompt">
            <p>Connect your Google Drive to store and run micro-apps.</p>
            <button data-action="sign-in">
              Connect Google Drive
            </button>
          </div>
        ` : this.loading ? `
          <div class="loading">Loading apps...</div>
        ` : `
          <div class="library-actions">
            <button data-action="create-app">+ New App</button>
          </div>

          ${this.apps.length === 0 ? `
            <div class="empty-state">
              <p>No apps yet. Create your first one!</p>
            </div>
          ` : `
            <ul class="app-list">
              ${this.apps.map(app => `
                <li class="app-item">
                  <a href="#/app/${app.id}" class="app-link">
                    <span class="app-name">${this.escapeHtml(app.name)}</span>
                    <span class="app-modified">${this.formatDate(app.modifiedTime)}</span>
                  </a>
                  <div class="app-actions">
                    <a href="#/app/${app.id}/edit" class="edit-link">Edit</a>
                    <button class="delete-btn secondary" data-action="delete-app" data-app-id="${app.id}" data-app-name="${this.escapeHtml(app.name)}">Delete</button>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        `}

        <settings-modal></settings-modal>
      </div>

      <style>
        .library {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .library-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .library-header h1 {
          margin: 0;
          font-size: 24px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
        }

        .connect-prompt {
          text-align: center;
          padding: 40px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .library-actions {
          margin-bottom: 16px;
        }

        .loading, .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .app-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .app-item {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 8px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .app-link {
          flex: 1;
          display: flex;
          justify-content: space-between;
          padding: 16px;
          color: inherit;
          text-decoration: none;
        }

        .app-link:hover {
          background: #f8f8f8;
        }

        .app-name {
          font-weight: 500;
        }

        .app-modified {
          color: #888;
          font-size: 14px;
        }

        .app-actions {
          display: flex;
          gap: 8px;
          padding-right: 12px;
        }

        .edit-link {
          padding: 6px 12px;
          color: #4285f4;
          text-decoration: none;
          font-size: 14px;
        }

        .delete-btn {
          padding: 6px 12px;
          font-size: 12px;
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

customElements.define('app-library', AppLibrary)
