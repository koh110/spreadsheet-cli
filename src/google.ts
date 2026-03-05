// https://developers.google.com/workspace/drive/api/quickstart/nodejs?hl=ja
import fs from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { spawn } from 'node:child_process'
import { URL } from 'node:url'
import { google, Auth } from 'googleapis'

export type ClientType = Auth.OAuth2Client
const CREDENTIALS_ENV_KEY = 'GOOGLE_CREDENTIALS_JSON'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const INVALID_REDIRECT_URI = `The provided credentials JSON does not define a valid
redirect URI. There must be at least one redirect URI defined, and this flow
assumes it redirects to 'http://localhost:3000/oauth2callback'. Please edit
your credentials JSON and add a 'redirect_uris' section. For example:

"redirect_uris": [
  "http://localhost:3000/oauth2callback"
]
`

function parseCredentials(credentialsJson: string) {
  try {
    return JSON.parse(credentialsJson)
  } catch (err) {
    throw new Error(`${CREDENTIALS_ENV_KEY} must be valid JSON`, { cause: err })
  }
}

function getCredentialKey(credentials: {
  installed?: { client_id: string; client_secret: string; redirect_uris?: string[] }
  web?: { client_id: string; client_secret: string; redirect_uris?: string[] }
}) {
  const key = credentials.installed || credentials.web
  if (!key) {
    throw new Error(`${CREDENTIALS_ENV_KEY} must include installed or web credentials`)
  }
  return { key, isInstalled: Boolean(credentials.installed) }
}

function isAddressInfo(address: ReturnType<http.Server['address']>): address is AddressInfo {
  return typeof address === 'object' && address !== null && typeof address.port === 'number'
}

function openBrowser(url: string) {
  console.log('Authorize this app by visiting this url:', url)
  const isWsl =
    process.platform === 'linux' &&
    (Boolean(process.env.WSL_DISTRO_NAME) || Boolean(process.env.WSL_INTEROP))

  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
      return
    }
    if (process.platform === 'win32') {
      spawn(
        'powershell',
        ['-NoProfile', '-Command', `Start-Process '${url.replaceAll("'", "''")}'`],
        { stdio: 'ignore', detached: true }
      ).unref()
      return
    }
    if (isWsl) {
      spawn(
        'powershell.exe',
        ['-NoProfile', '-Command', `Start-Process '${url.replaceAll("'", "''")}'`],
        { stdio: 'ignore', detached: true }
      ).unref()
      return
    }
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
  } catch {
  }
}

async function authenticateWithCredentials(credentialsJson: string) {
  const credentials = parseCredentials(credentialsJson)
  const { key, isInstalled } = getCredentialKey(credentials)
  if (!key.redirect_uris || key.redirect_uris.length === 0) {
    throw new Error(INVALID_REDIRECT_URI)
  }
  const redirectUri = new URL(key.redirect_uris[0] ?? 'http://localhost')
  if (redirectUri.hostname !== 'localhost') {
    throw new Error(INVALID_REDIRECT_URI)
  }

  const client = new Auth.OAuth2Client({
    clientId: key.client_id,
    clientSecret: key.client_secret,
  })

  return new Promise<Auth.OAuth2Client>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '', 'http://localhost:3000')
        if (url.pathname !== redirectUri.pathname) {
          res.end('Invalid callback URL')
          return
        }
        const searchParams = url.searchParams
        if (searchParams.has('error')) {
          res.end('Authorization rejected.')
          reject(new Error(searchParams.get('error') ?? 'Authorization rejected.'))
          return
        }
        const code = searchParams.get('code')
        if (!code) {
          res.end('No authentication code provided.')
          reject(new Error('Cannot read authentication code.'))
          return
        }
        const { tokens } = await client.getToken({
          code,
          redirect_uri: redirectUri.toString(),
        })
        client.credentials = tokens
        res.end('Authentication successful! Please return to the console.')
        resolve(client)
      } catch (err) {
        reject(err)
      } finally {
        server.close()
      }
    })

    let listenPort = 3000
    if (isInstalled) {
      listenPort = 0
    } else if (redirectUri.port !== '') {
      listenPort = Number(redirectUri.port)
    }

    server.listen(listenPort, () => {
      const address = server.address()
      if (isAddressInfo(address)) {
        redirectUri.port = String(address.port)
      }
      const authorizeUrl = client.generateAuthUrl({
        redirect_uri: redirectUri.toString(),
        access_type: 'offline',
        scope: SCOPES.join(' '),
      })
      openBrowser(authorizeUrl)
    })
  })
}

async function loadSavedCredentialsIfExist(tokenPath: string) {
  try {
    const content = await fs.readFile(tokenPath, { encoding: 'utf-8' })
    const credentials = JSON.parse(content)
    const client = google.auth.fromJSON(credentials) as Auth.OAuth2Client
    await client.refreshAccessToken()
    return client
  } catch (err) {
    try {
      await fs.unlink(tokenPath)
    } catch (e) {
      // ignore
    }
    return null;
  }
}

async function saveCredentials(client: Auth.OAuth2Client, options: { credentialsJson: string; tokenPath: string }) {
  const keys = parseCredentials(options.credentialsJson)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  })
  await fs.writeFile(options.tokenPath, payload)
}

/**
 * Load or request or authorization to call APIs.
 *
 */
export async function authenticate(options: {
  tokenPath: string
  credentialsJson: string
}) {
  const jsonClient = await loadSavedCredentialsIfExist(options.tokenPath)
  if (jsonClient) {
    return jsonClient
  }
  if (!options.credentialsJson) {
    throw new Error(`${CREDENTIALS_ENV_KEY} is not set`)
  }
  const client = await authenticateWithCredentials(options.credentialsJson)
  if (client.credentials) {
    await saveCredentials(client, { credentialsJson: options.credentialsJson, tokenPath: options.tokenPath })
  }
  return client
}
