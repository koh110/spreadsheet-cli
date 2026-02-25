# spreadsheet-cli

CLI tool to read Google Spreadsheets with multi-profile management and automatic fallback.

## Features

- 📊 Read data from Google Spreadsheets
- 👤 Manage multiple authentication profiles
- 🔄 Automatic fallback with priority-based profile selection
- 🎯 Interactive profile creation
- 🔑 Support for API Keys and Service Account authentication
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
node --experimental-strip-types src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1!A1:D10

# Use a specific profile
node --experimental-strip-types src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --profile myprofile

# Output as JSON
node --experimental-strip-types src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --format json

# Output as CSV
node --experimental-strip-types src/index.ts read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1 --format csv
```

Or use npm scripts:

```bash
npm start read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1
```

### Profile Management

#### Add a new profile
```bash
node --experimental-strip-types src/index.ts profile:add
```

#### List all profiles
```bash
node --experimental-strip-types src/index.ts profile:list
```

#### Set default profile
```bash
node --experimental-strip-types src/index.ts profile:set-default --name myprofile
```

#### Remove a profile
```bash
node --experimental-strip-types src/index.ts profile:remove --name myprofile
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