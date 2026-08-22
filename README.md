# VeloceBill Pro

Expo mobile billing app with a local JSON-backed API.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the backend API:

```bash
npm run api
```

In another terminal, start Expo:

```bash
npm run start
```

## Mobile Backend URL

The app reads `EXPO_PUBLIC_BACKEND_URL` and calls `${EXPO_PUBLIC_BACKEND_URL}/api`.

Use these values:

- Web or iOS simulator: `http://localhost:4000`
- Android emulator: `http://10.0.2.2:4000`
- Physical phone: your computer LAN IP, for example `http://192.168.1.20:4000`

Create a `.env` file from `.env.example` and update the URL before starting Expo.

## Data

The backend stores products, bills, documents, and profile details in `backend/data.json`.

## Standalone App (No Expo Go)

The project is configured for Expo EAS Build with app id `com.velocebill.pro`.

Before building a standalone app, set the real backend URL in `eas.json`:

- Replace `https://your-api-domain.com` in the `preview` and `production` profiles
- The URL must be reachable from the phone (a deployed API, not `localhost`)
- For local phone testing only, use your computer LAN IP: `http://192.168.1.20:4000`

Install EAS CLI and log in:

```bash
npm install -g eas-cli
eas login
```

Build an installable Android APK:

```bash
eas build -p android --profile preview
```

Build a Play Store AAB:

```bash
eas build -p android --profile production
```

iOS builds require an Apple Developer account:

```bash
eas build -p ios --profile production
```

The first Android build generates keystore credentials automatically; accept the defaults when prompted.
