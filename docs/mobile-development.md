# Mobile Development

This project now uses Capacitor to package the existing Vite app for Android and iOS.

## Available commands

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

1. Run `npm run build:mobile` after web changes.
2. Open Android Studio with `npm run android` and run the app on an emulator or device.
3. Open Xcode with `npm run ios` on macOS and run the app on a simulator or device.

## Platform notes

- Android development can continue from Windows.
- iOS project files are present in the repo, but building and signing iOS requires macOS with Xcode.
