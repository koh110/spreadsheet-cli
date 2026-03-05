import path from 'node:path'
import os from 'node:os'

export const CONFIG_DIR = path.join(
  os.homedir(),
  '.config/koh110/spreadsheet-cli'
)
export const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json')
export const TOKEN_DIR = path.join(os.tmpdir(), 'koh110', 'spreadsheet-cli')
export const TOKEN_PATH = path.join(TOKEN_DIR, 'token.json')
