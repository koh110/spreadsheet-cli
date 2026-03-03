# spreadsheet-cli

CLI tool to read Google Spreadsheets with multi-profile management and automatic fallback.

## Features

- 📊 Read data from Google Spreadsheets
- 👤 Manage multiple authentication profiles
- 🔄 Automatic fallback with priority-based profile selection
- 🎯 Interactive profile creation
- 🔑 Support for API Keys, Service Accounts, and OAuth authentication
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

#### Set default profile
```bash
node src/index.ts profile:set-default --name myprofile
```

#### Remove a profile
```bash
node src/index.ts profile:remove --name myprofile
```

## Authentication

### API Key
For simple read-only access, you can use a Google API Key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Sheets API
4. Create an API Key
5. Make sure your spreadsheet is publicly readable or shared with anyone with the link

### Service Account
For more secure access:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Sheets API
4. Create a Service Account
5. Download the JSON key file
6. Share your spreadsheet with the service account email
7. When creating a profile, paste the client_email and private_key from the JSON file

### ADC (User)
For user-owned spreadsheets without service accounts:
1. Install Google Cloud CLI and run `gcloud auth application-default login`
2. This creates ADC credentials (default: `~/.config/gcloud/application_default_credentials.json`)
3. When creating an ADC profile, set `adcCredentialPath` to the ADC JSON file path
4. Create separate ADC profiles with different ADC files if you need per-profile identities

## Profile Priority

Profiles have a priority setting (lower number = higher priority). When reading a spreadsheet:
1. The default profile is tried first
2. If it fails, other profiles are tried in priority order
3. The first successful profile is used

This allows automatic fallback when a profile's quota is exhausted or authentication fails.

## Configuration

Profiles are stored in `~/.spreadsheet-cli/config.json`

## License

MIT
