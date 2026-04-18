# Mobile Development

This project now uses Capacitor to package the existing Vite app for Android and iOS.

## Available commands

- `npm run dev:android`
  Starts Vite on your local network and launches the Android app with Capacitor live reload.
- `npm run dev:host`
  Starts the Vite dev server on your local network for mobile testing.
- `npm run android:live`
  Runs the Android app against the Vite dev server on port `5173`.
- `npm run build:mobile`
  Builds the web app and syncs the latest assets into the native projects.
- `npm run cap:sync`
  Syncs Capacitor config and copied web assets into Android and iOS.
- `npm run cap:copy`
  Copies the built web assets into the native projects without a full sync.
- `npm run android`
  Opens the Android project in Android Studio.
- `npm run ios`
  Opens the iOS project in Xcode.

## Current app id

- `com.skycanvas.weather`

This is a provisional bundle identifier and can still be changed before store submission.

## Local workflow

### Android-first loop

1. Start an Android emulator in Android Studio, or connect a physical Android device with USB debugging enabled.
2. Run `npm run dev:android`.
3. Keep that terminal running while you edit the app. Vite serves the web bundle, and Capacitor launches Android against that live server.

Notes:

- The Android emulator is the easiest path from Windows.
- A physical device should be on the same network as your computer for live reload to work reliably.
- If the native shell is already open and you only changed the web app, you can usually rerun `npm run android:live`.

### Synced build workflow

1. Run `npm run build:mobile` after web changes you want copied into the native projects.
2. Open Android Studio with `npm run android` and run the app on an emulator or device.
3. Open Xcode with `npm run ios` on macOS and run the app on a simulator or device.

## Platform notes

- Android development can continue from Windows.
- iOS project files are present in the repo, but building and signing iOS requires macOS with Xcode.
