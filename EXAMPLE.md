# Example Usage

## Step-by-step Guide

### 1. Build the project

```bash
npm install
npm run build
```

### 2. Add your first profile

When you run a read command for the first time, you'll be prompted to create a profile:

```bash
node dist/index.js read --spreadsheet-id YOUR_SPREADSHEET_ID
```

This will start an interactive prompt:

```
No profiles found. Let's create one!

? Profile name: default
? Authentication type: API Key
? API Key: YOUR_API_KEY_HERE
? Priority (lower number = higher priority): 1
? Set as default profile? Yes

✓ Profile "default" created successfully!
```

### 3. Add additional profiles with different priorities

You can add multiple profiles for fallback:

```bash
node dist/index.js profile:add
```

Interactive prompt example:

```
? Profile name: backup
? Authentication type: Service Account (JSON key)
? Service account email: your-service-account@project.iam.gserviceaccount.com
? Private key (paste the key including -----BEGIN/END PRIVATE KEY-----): 
-----BEGIN PRIVATE KEY-----
...your key here...
-----END PRIVATE KEY-----
? Priority (lower number = higher priority): 2
? Set as default profile? No

✓ Profile "backup" created successfully!
```

### 4. Read spreadsheet data

#### Using default profile with automatic fallback:

```bash
node dist/index.js read --spreadsheet-id 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --range "Class Data!A1:E"
```

Output example:
```
Trying profile: default (priority: 1)
✓ Successfully read with profile: default

Data retrieved using profile: default

Name    Gender  Class Level Hometown
Alexandra       Female  4. Senior       CA
Andrew  Male    1. Freshman DE
...
```

#### Using specific profile:

```bash
node dist/index.js read --spreadsheet-id 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --range "Class Data!A1:E" --profile backup
```

#### Output as JSON:

```bash
node dist/index.js read --spreadsheet-id 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --range "Class Data!A1:E" --format json
```

### 5. Manage profiles

#### List all profiles:

```bash
node dist/index.js profile:list
```

Output:
```
Profiles:

  default [DEFAULT]
    Priority: 1
    Auth: API Key

  backup
    Priority: 2
    Auth: Service Account
```

#### Change default profile:

```bash
node dist/index.js profile:set-default --name backup
```

#### Remove a profile:

```bash
node dist/index.js profile:remove --name backup
```

## How Fallback Works

When you run a read command without specifying a profile:

1. The **default profile** is tried first (regardless of priority)
2. If it fails, profiles are tried in **priority order** (lowest number first)
3. The first successful profile is used to read the data
4. All attempts and results are logged to the console

Example with fallback:

```bash
node dist/index.js read --spreadsheet-id YOUR_SPREADSHEET_ID --range Sheet1
```

Console output:
```
Trying profile: default (priority: 1)
✗ Failed with profile "default": The request is missing a valid API key.
Trying profile: backup (priority: 2)
✓ Successfully read with profile: backup

Data retrieved using profile: backup

[spreadsheet data here]
```

## Use Cases

### Use Case 1: Multiple API Keys for Rate Limiting

Create multiple profiles with different API keys to handle rate limits:

```bash
# Add first API key with priority 1
node dist/index.js profile:add
# name: api-key-1, auth: API Key, priority: 1, default: yes

# Add second API key with priority 2
node dist/index.js profile:add
# name: api-key-2, auth: API Key, priority: 2, default: no

# Add third API key with priority 3
node dist/index.js profile:add
# name: api-key-3, auth: API Key, priority: 3, default: no
```

Now when you read a spreadsheet, if one key hits the rate limit, it automatically falls back to the next.

### Use Case 2: Service Account + API Key Fallback

Use a service account as primary and API key as backup:

```bash
# Add service account with priority 1
node dist/index.js profile:add
# name: service-account, auth: Service Account, priority: 1, default: yes

# Add API key with priority 2
node dist/index.js profile:add
# name: api-key-backup, auth: API Key, priority: 2, default: no
```

## Configuration File

Profiles are stored in `~/.spreadsheet-cli/config.json`:

```json
{
  "profiles": [
    {
      "name": "default",
      "apiKey": "YOUR_API_KEY",
      "priority": 1,
      "isDefault": true
    },
    {
      "name": "backup",
      "clientEmail": "service@project.iam.gserviceaccount.com",
      "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "priority": 2,
      "isDefault": false
    }
  ]
}
```

## Testing with Public Spreadsheet

You can test with Google's public sample spreadsheet:

```bash
# This spreadsheet is publicly accessible
node dist/index.js read \
  --spreadsheet-id 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --range "Class Data!A1:E"
```

**Note:** You'll need an API key even for public spreadsheets. Create one at [Google Cloud Console](https://console.cloud.google.com/).
