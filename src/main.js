import './styles/main.css'
import './components/app-library.js'
import './components/app-runner.js'
import './components/app-editor.js'
import './components/app-creator.js'
import './components/session-manager.js'
import { googleAuth } from './lib/google-auth.js'

// Simple router based on hash
function route() {
  const hash = window.location.hash || '#/'
  const app = document.getElementById('app')

  // Handle OAuth callback
  if (hash.includes('access_token')) {
    googleAuth.handleCallback()
    window.location.hash = '#/'
    return
  }

  // Route to components
  if (hash === '#/create') {
    app.innerHTML = '<app-creator></app-creator>'
  } else if (hash.startsWith('#/app/')) {
    const appId = hash.slice(6).split('/')[0]
    const mode = hash.includes('/edit') ? 'edit' : 'run'
    if (mode === 'edit') {
      app.innerHTML = `<app-editor app-id="${appId}"></app-editor>`
    } else {
      app.innerHTML = `<app-runner app-id="${appId}"></app-runner>`
    }
  } else {
    app.innerHTML = '<app-library></app-library>'
  }
}

window.addEventListener('hashchange', route)
route()
