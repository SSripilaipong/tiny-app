import { googleAuth } from './google-auth.js'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const ROOT_FOLDER_NAME = 'tiny-app.dev'
const CACHE_PREFIX = 'tiny_app_cache_'
const APP_CACHE_KEY = 'tiny_app_files_cache'
const APP_CACHE_MAX = 4

class DriveClient {
  constructor() {
    this.rootFolderId = null
    this.fileIdCache = {} // in-memory cache for file IDs
  }

  // ============ Cache helpers ============

  cacheGet(key) {
    try {
      const data = localStorage.getItem(CACHE_PREFIX + key)
      if (!data) return null
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  cacheSet(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value))
    } catch (e) {
      console.warn('Cache write failed:', e)
    }
  }

  cacheDelete(key) {
    localStorage.removeItem(CACHE_PREFIX + key)
  }

  // ============ App files LRU cache ============

  getAppCache() {
    try {
      const data = localStorage.getItem(APP_CACHE_KEY)
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  setAppCache(appId, data) {
    try {
      const cache = this.getAppCache()

      // Add/update entry with timestamp for LRU
      cache[appId] = {
        ...data,
        cachedAt: Date.now()
      }

      // LRU eviction if over limit
      const entries = Object.entries(cache)
      if (entries.length > APP_CACHE_MAX) {
        entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt)
        const toRemove = entries.slice(0, entries.length - APP_CACHE_MAX)
        toRemove.forEach(([id]) => delete cache[id])
      }

      localStorage.setItem(APP_CACHE_KEY, JSON.stringify(cache))
    } catch (e) {
      console.warn('App cache write failed:', e)
    }
  }

  getAppFromCache(appId) {
    const cache = this.getAppCache()
    return cache[appId] || null
  }

  // ============ API helpers ============

  async request(url, options = {}) {
    const token = googleAuth.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Drive API error: ${response.status}`)
    }

    return response.json()
  }

  // ============ Folder operations ============

  async ensureRootFolder() {
    if (this.rootFolderId) {
      return this.rootFolderId
    }

    // Check localStorage cache
    const cached = this.cacheGet('rootFolderId')
    if (cached) {
      this.rootFolderId = cached
      return cached
    }

    // Search for existing folder
    const query = `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const result = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    )

    if (result.files.length > 0) {
      this.rootFolderId = result.files[0].id
      this.cacheSet('rootFolderId', this.rootFolderId)
      return this.rootFolderId
    }

    // Create new folder
    const folder = await this.request(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    })

    this.rootFolderId = folder.id
    this.cacheSet('rootFolderId', this.rootFolderId)
    return this.rootFolderId
  }

  // ============ App operations ============

  async listApps() {
    const rootId = await this.ensureRootFolder()

    const query = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const result = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
    )

    // Cache app list
    this.cacheSet('appList', result.files)
    return result.files
  }

  async createApp(name, template = null) {
    const rootId = await this.ensureRootFolder()

    // Create app folder
    const folder = await this.request(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootId]
      })
    })

    const appId = folder.id

    // Create sessions subfolder
    const sessionsFolder = await this.request(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'sessions',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [appId]
      })
    })

    // Cache sessions folder ID
    this.cacheSet(`sessionsFolderId_${appId}`, sessionsFolder.id)

    // Default manifest
    const manifest = {
      name,
      version: '1.0.0',
      params: {},
      sessionSchema: {}
    }

    // Default app HTML
    const appHtml = template || `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${name}</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p>Edit this app to get started.</p>
  <script>
    // Listen for init message from parent
    window.addEventListener('message', (e) => {
      if (e.data.type === 'init') {
        console.log('App initialized with:', e.data);
        // Your app logic here
      }
    });

    // Signal ready
    window.parent.postMessage({ type: 'ready' }, '*');
  </script>
</body>
</html>`

    const params = {}

    // Create files and cache their IDs
    const [manifestFile, appHtmlFile, paramsFile] = await Promise.all([
      this.createFile(appId, 'manifest.json', JSON.stringify(manifest, null, 2)),
      this.createFile(appId, 'app.html', appHtml),
      this.createFile(appId, 'params.json', JSON.stringify(params, null, 2))
    ])

    // Cache file IDs
    this.cacheSet(`fileId_${appId}_manifest.json`, manifestFile.id)
    this.cacheSet(`fileId_${appId}_app.html`, appHtmlFile.id)
    this.cacheSet(`fileId_${appId}_params.json`, paramsFile.id)

    // Cache app files content
    this.cacheSet(`appFiles_${appId}`, { manifest, params, appHtml })

    return { id: appId, name }
  }

  async deleteApp(appId) {
    // Clear all caches for this app
    this.cacheDelete(`appFiles_${appId}`)
    this.cacheDelete(`sessionsFolderId_${appId}`)
    this.cacheDelete(`sessions_${appId}`)
    this.cacheDelete(`fileId_${appId}_manifest.json`)
    this.cacheDelete(`fileId_${appId}_app.html`)
    this.cacheDelete(`fileId_${appId}_params.json`)

    return this.request(`${DRIVE_API}/files/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true })
    })
  }

  // ============ File operations ============

  async createFile(parentId, name, content) {
    const metadata = {
      name,
      parents: [parentId]
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([content], { type: 'text/plain' }))

    const token = googleAuth.getToken()
    const response = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    })

    if (!response.ok) {
      throw new Error(`Failed to create file: ${name}`)
    }

    return response.json()
  }

  async updateFile(fileId, content) {
    const token = googleAuth.getToken()
    const response = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body: content
    })

    if (!response.ok) {
      throw new Error('Failed to update file')
    }

    return response.json()
  }

  async getFileContent(fileId) {
    const token = googleAuth.getToken()
    const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error('Failed to get file content')
    }

    return response.text()
  }

  async findFile(parentId, name) {
    // Check cache first
    const cacheKey = `fileId_${parentId}_${name}`
    const cachedId = this.cacheGet(cacheKey)
    if (cachedId) {
      return { id: cachedId, name }
    }

    const query = `'${parentId}' in parents and name='${name}' and trashed=false`
    const result = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    )

    const file = result.files[0] || null
    if (file) {
      this.cacheSet(cacheKey, file.id)
    }
    return file
  }

  // ============ App files (cached) ============

  async getAppFiles(appId, forceRefresh = false) {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = this.getAppFromCache(appId)
      if (cached) {
        return {
          manifest: cached.manifest,
          params: cached.params,
          appHtml: cached.appHtml,
          syncTime: cached.cachedAt
        }
      }
    }

    // Fetch from Drive
    const [manifest, params, appHtml] = await Promise.all([
      this.findFile(appId, 'manifest.json').then(f => f ? this.getFileContent(f.id) : null),
      this.findFile(appId, 'params.json').then(f => f ? this.getFileContent(f.id) : null),
      this.findFile(appId, 'app.html').then(f => f ? this.getFileContent(f.id) : null)
    ])

    const result = {
      manifest: manifest ? JSON.parse(manifest) : null,
      params: params ? JSON.parse(params) : null,
      appHtml
    }

    // Cache the result
    const syncTime = Date.now()
    this.setAppCache(appId, { ...result, syncTime })

    return { ...result, syncTime }
  }

  async saveAppHtml(appId, content) {
    const file = await this.findFile(appId, 'app.html')
    const result = file
      ? await this.updateFile(file.id, content)
      : await this.createFile(appId, 'app.html', content)

    // Update cache with new content
    const cached = this.getAppFromCache(appId)
    if (cached) {
      this.setAppCache(appId, { ...cached, appHtml: content })
    }

    return result
  }

  async saveManifest(appId, manifest) {
    // No caching - just save to Drive
    const file = await this.findFile(appId, 'manifest.json')
    const content = JSON.stringify(manifest, null, 2)
    if (file) {
      return this.updateFile(file.id, content)
    } else {
      return this.createFile(appId, 'manifest.json', content)
    }
  }

  async saveParams(appId, params) {
    // No caching - just save to Drive
    const file = await this.findFile(appId, 'params.json')
    const content = JSON.stringify(params, null, 2)
    if (file) {
      return this.updateFile(file.id, content)
    } else {
      return this.createFile(appId, 'params.json', content)
    }
  }

  // ============ Session operations (cached) ============

  async getSessionsFolderId(appId) {
    // Check cache
    const cached = this.cacheGet(`sessionsFolderId_${appId}`)
    if (cached) {
      return cached
    }

    const folder = await this.findFile(appId, 'sessions')
    if (!folder) {
      const newFolder = await this.request(`${DRIVE_API}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'sessions',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [appId]
        })
      })
      this.cacheSet(`sessionsFolderId_${appId}`, newFolder.id)
      return newFolder.id
    }

    this.cacheSet(`sessionsFolderId_${appId}`, folder.id)
    return folder.id
  }

  async listSessions(appId) {
    const sessionsFolderId = await this.getSessionsFolderId(appId)

    const query = `'${sessionsFolderId}' in parents and trashed=false`
    const result = await this.request(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
    )

    const sessions = result.files.map(f => ({
      id: f.id,
      name: f.name.replace('.json', ''),
      modifiedTime: f.modifiedTime
    }))

    // Cache session list
    this.cacheSet(`sessions_${appId}`, sessions)
    return sessions
  }

  async getSession(sessionId, forceRefresh = false) {
    const cacheKey = `session_${sessionId}`

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = this.cacheGet(cacheKey)
      if (cached) {
        return { ...cached.data, syncTime: cached.syncTime }
      }
    }

    // Fetch from Drive
    const content = await this.getFileContent(sessionId)
    const data = JSON.parse(content)

    // Cache the result
    const syncTime = Date.now()
    this.cacheSet(cacheKey, { data, syncTime })

    return { ...data, syncTime }
  }

  async saveSession(sessionId, data) {
    const result = await this.updateFile(sessionId, JSON.stringify(data, null, 2))

    // Update cache
    this.cacheSet(`session_${sessionId}`, { data, syncTime: Date.now() })

    return result
  }

  async createSession(appId, name) {
    const sessionsFolderId = await this.getSessionsFolderId(appId)

    const sessionData = {
      name,
      createdAt: new Date().toISOString(),
      data: {}
    }

    const file = await this.createFile(
      sessionsFolderId,
      `${name}.json`,
      JSON.stringify(sessionData, null, 2)
    )

    // Cache session
    this.cacheSet(`session_${file.id}`, sessionData)

    // Invalidate session list cache (will be refreshed on next listSessions)
    this.cacheDelete(`sessions_${appId}`)

    return { id: file.id, name, data: sessionData }
  }
}

export const driveClient = new DriveClient()
