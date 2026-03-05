#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { createProfileManager } from './profile-manager.ts'

const profileManager = await createProfileManager()

function showHelp() {
  console.log(`
Usage: spreadsheet-cli <command> [options]

Commands:
  read                     Read data from a Google Spreadsheet
  profile:add              Add a new profile
  profile:list             List all profiles
  profile:remove           Remove a profile
  help                     Show this help message

Options for 'read' command:
  -s, --spreadsheet-id <id>  Spreadsheet ID (required)
  -r, --range <range>        Range to read (default: "Sheet1")
  -p, --profile <name>       Profile name to use
  -f, --format <format>      Output format: json|csv|table (default: "table")

Options for 'profile:remove' command:
  -n, --name <name>          Profile name (required)

Examples:
  spreadsheet-cli read -s 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms -r "Sheet1!A1:D10"
  spreadsheet-cli profile:add
  spreadsheet-cli profile:list
  spreadsheet-cli profile:remove -n myprofile
`)
}

// Main execution
const { values, positionals } = parseArgs({
  options: {
    help: {
      type: 'boolean',
      short: 'h'
    }
  },
  allowPositionals: true,
  strict: false
})

if (
  positionals.length === 0 ||
  positionals[0] === 'help' ||
  values.help === true
) {
  showHelp()
  process.exit(0)
}

const [command, ...args] = positionals

switch (command) {
  case 'read':
    await import('./commands.ts').then((module) =>
      module.handleReadCommand(profileManager)
    )
    break
  case 'profile:clear':
    await import('./commands.ts').then((module) =>
      module.handleProfileClearCommand(profileManager)
    )
    break
  case 'profile:add':
    await import('./commands.ts').then((module) =>
      module.handleProfileAddCommand(profileManager)
    )
    break
  case 'profile:list':
    await import('./commands.ts').then((module) =>
      module.handleProfileListCommand(profileManager)
    )
    break
  case 'profile:remove':
    await import('./commands.ts').then((module) =>
      module.handleProfileRemoveCommand(profileManager, args)
    )
    break
  default:
    console.error(`Error: Unknown command "${command}"`)
    console.log('Run "spreadsheet-cli help" for usage information')
    process.exit(1)
}
