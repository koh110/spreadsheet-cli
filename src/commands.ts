import { parseArgs } from 'node:util'
import { z } from 'zod'
import type { createProfileManager } from './profile-manager.ts'
import { createProfileInteractive, addProfileCommand } from './interactive.ts'
import {
  createSpreadsheetReader,
  type SpreadsheetValues,
  type ValueInputOption
} from './spreadsheet-reader.ts'

type ProfileManager = Awaited<ReturnType<typeof createProfileManager>>
type Profile =
  ProfileManager['getProfilesSortedByPriority'] extends () => infer T
    ? T extends Array<infer U>
      ? U
      : never
    : never

const writeValuesSchema = z.array(
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
)

function ensureProfiles(
  profileManager: ProfileManager,
  options: Parameters<typeof createProfileInteractive>[1] = {}
) {
  if (profileManager.hasProfiles()) {
    return
  }
  return createProfileInteractive(profileManager, options)
}

function resolveProfiles(
  profileManager: ProfileManager,
  profileName: string | undefined
) {
  if (profileName) {
    const profile = profileManager.getProfile(profileName)
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found`)
    }
    return [profile]
  }

  const profiles = profileManager.getProfilesSortedByPriority()
  if (profiles.length === 0) {
    throw new Error('No profiles available')
  }

  return profiles
}

function filterWritableProfiles(profiles: Profile[]) {
  return profiles.filter((profile) => profile.authType !== 'apiKey')
}

function parseWriteValues(valuesText: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(valuesText)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`--values must be valid JSON: ${message}`)
  }

  const result = writeValuesSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('--values must be a JSON two-dimensional array')
  }

  return result.data satisfies SpreadsheetValues
}

function parseValueInputOption(value: string | undefined) {
  if (!value) {
    return 'RAW' satisfies ValueInputOption
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'raw') {
    return 'RAW' satisfies ValueInputOption
  }
  if (normalized === 'user-entered') {
    return 'USER_ENTERED' satisfies ValueInputOption
  }

  throw new Error('--value-input-option must be one of: raw, user-entered')
}

export async function handleReadCommand(profileManager: ProfileManager) {
  const reader = await createSpreadsheetReader()
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      'spreadsheet-id': { type: 'string', short: 's' },
      range: { type: 'string', short: 'r', default: 'Sheet1' },
      profile: { type: 'string', short: 'p' },
      format: { type: 'string', short: 'f', default: 'table' }
    },
    strict: true
  })

  if (!values['spreadsheet-id']) {
    console.error('Error: --spreadsheet-id (-s) is required for read command')
    process.exit(1)
  }

  try {
    await ensureProfiles(profileManager)
    const profiles = resolveProfiles(profileManager, values.profile)

    const { data } = await reader.readWithFallback(
      values['spreadsheet-id'],
      values.range || 'Sheet1',
      profiles
    )

    // Format output
    if (values.format === 'json') {
      console.log(JSON.stringify(data, null, 2))
    } else if (values.format === 'csv') {
      for (const row of data) {
        console.log(row.map((cell) => `"${cell}"`).join(','))
      }
    } else {
      // Table format
      for (const row of data) {
        console.log(row.join('\t'))
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}

export async function handleWriteCommand(profileManager: ProfileManager) {
  const reader = await createSpreadsheetReader()
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      'spreadsheet-id': { type: 'string', short: 's' },
      range: { type: 'string', short: 'r', default: 'Sheet1' },
      profile: { type: 'string', short: 'p' },
      values: { type: 'string', short: 'v' },
      'value-input-option': {
        type: 'string',
        default: 'raw'
      }
    },
    strict: true
  })

  if (!values['spreadsheet-id']) {
    console.error('Error: --spreadsheet-id (-s) is required for write command')
    process.exit(1)
  }

  if (!values.values) {
    console.error('Error: --values (-v) is required for write command')
    process.exit(1)
  }

  try {
    await ensureProfiles(profileManager, {
      allowedAuthTypes: ['serviceAccount', 'oauthCredentials'],
      introMessage: "\nNo profiles found. Let's create one with write access!\n"
    })

    const profiles = resolveProfiles(profileManager, values.profile)
    const writableProfiles = filterWritableProfiles(profiles)
    if (writableProfiles.length === 0) {
      throw new Error(
        'Write command requires an OAuth credentials command or service account profile'
      )
    }

    const writeValues = parseWriteValues(values.values)
    const valueInputOption = parseValueInputOption(values['value-input-option'])

    const result = await reader.writeWithFallback(
      values['spreadsheet-id'],
      values.range || 'Sheet1',
      writeValues,
      valueInputOption,
      writableProfiles
    )

    console.log(
      `Wrote ${result.data.updatedCells} cells to ${result.data.updatedRange} using profile "${result.profile.name}"`
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}

export async function handleProfileClearCommand(
  profileManager: ProfileManager
) {
  try {
    await profileManager.clearProfiles()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}

export async function handleProfileAddCommand(profileManager: ProfileManager) {
  try {
    await addProfileCommand(profileManager)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}

export function handleProfileListCommand(profileManager: ProfileManager) {
  const profiles = profileManager.getProfiles()
  if (profiles.length === 0) {
    console.log('No profiles found')
    return
  }

  console.log('\nProfiles:\n')
  for (const profile of profiles) {
    const authType =
      profile.authType === 'apiKey'
        ? 'API Key'
        : profile.authType === 'oauthCredentials'
          ? 'OAuth credentials command'
          : 'Service Account'
    console.log(`  ${profile.name}`)
    console.log(`    Priority: ${profile.priority}`)
    console.log(`    Auth: ${authType}`)
    if (profile.authType === 'oauthCredentials') {
      console.log(`    credentials command: ${profile.command}`)
    }
    console.log()
  }
}

export async function handleProfileRemoveCommand(
  profileManager: ProfileManager,
  args: string[]
) {
  const { values } = parseArgs({
    args,
    options: {
      name: { type: 'string', short: 'n' }
    },
    strict: true
  })

  if (!values.name) {
    console.error('Error: --name (-n) is required for profile:remove command')
    process.exit(1)
  }

  const success = await profileManager.removeProfile(values.name)
  if (success) {
    console.log(`✓ Profile "${values.name}" removed`)
  } else {
    console.error(`Error: Profile "${values.name}" not found`)
    process.exit(1)
  }
}
