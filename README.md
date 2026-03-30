# spreadsheet-cli

CLI tool to read and write Google Spreadsheets with multi-profile management and automatic fallback.

## Features

- 📊 Read data from Google Spreadsheets
- ✍️ Write data to Google Spreadsheets
- 👤 Manage multiple authentication profiles
- 🔄 Automatic fallback with priority-based profile selection
- 🎯 Interactive profile creation
- 🔑 Support for OAuth credentials command, API Keys, and Service Accounts authentication
- 📤 Multiple output formats (JSON, CSV, Table)

## Installation

```bash
npm install
```

Or install globally:

```bash
npm install -g .
```

## Usage

### Read a Spreadsheet

```bash
# First run will prompt you to create a profile interactively
node src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1!A1:D10

# Use a specific profile
node src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --profile myprofile

# Output as JSON
node src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --format json

# Output as CSV
node src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --format csv
```

### Write to a Spreadsheet

```bash
# Write raw values
node src/index.ts write \
  --spreadsheet-id YOUR_SPREADSHEET_ID \
  --range Sheet1!A1:B2 \
  --values '[["Name","Score"],["Alice",10]]'

# Let Sheets parse entered values like formulas and dates
node src/index.ts write \
  --spreadsheet-id YOUR_SPREADSHEET_ID \
  --range Sheet1!A1 \
  --values '[["=TODAY()"]]' \
  --value-input-option user-entered
```

Or use npm scripts:

```bash
npm start read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1
```

### Profile Management

#### Add a new profile
```bash
node src/index.ts profile:add
```

#### List all profiles
```bash
node src/index.ts profile:list
```

#### Remove a profile
```bash
node src/index.ts profile:remove --name myprofile
```

## Authentication

### OAuth credentials command (User)
Main recommended option for user-owned spreadsheets:
1. Prepare a command that outputs `GOOGLE_CREDENTIALS_JSON=...` (OAuth client credentials JSON, for example via 1Password CLI)
2. Configure that command in the profile (`authType: oauthCredentials`)
3. On first run, the CLI opens your browser for consent automatically and stores token at `~/.config/koh110/spreadsheet-cli/token.json`

### API Key
For simple read-only access, you can use a Google API Key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Sheets API
4. Create an API Key
5. Make sure your spreadsheet is publicly readable or shared with anyone with the link

### Service Account
For service-to-service access:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Sheets API
4. Create a Service Account
5. Download the JSON key file
6. Share your spreadsheet with the service account email
7. When creating a profile, paste the client_email and private_key from the JSON file

`write` requires either an OAuth credentials profile or a service account profile. API keys are read-only and cannot update spreadsheet values.

## Profile Priority

Profiles have a priority setting (lower number = higher priority). When running a spreadsheet command:
1. Profiles are tried in priority order
2. The first successful profile is used

This allows automatic fallback when a profile's quota is exhausted or authentication fails.

## Configuration

Profiles are stored in `~/.spreadsheet-cli/config.json`

## License

MIT
