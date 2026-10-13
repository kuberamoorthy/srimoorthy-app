# 🚀 Sri Moorthy Fleet — Flutter Mobile APK Guide

This project now contains a complete **Flutter Android App** in the [`flutter_app/`](file:///c:/Users/Kubera/OneDrive/Desktop/app/flutter_app/) directory that compiles into a standalone `.apk` for Android phones and tablets.

---

## 📱 Features of the Flutter Mobile App
- **High-Performance WebView Engine**: Renders the complete Sri Moorthy Fleet UI with 60 FPS hardware acceleration.
- **Offline Assets**: Bundled locally in `flutter_app/assets/web/` so the app loads instantly even with zero internet.
- **Hardware Back-Button Navigation**: Pressing the Android back button navigates backwards through web history/modals without accidentally quitting the app.
- **Native Geolocation & GPS**: Auto-grants geolocation access for the aerospace fleet radar.
- **Camera & Gallery Attachments**: Supports capturing odometer photos and receipt uploads.
- **WhatsApp Bill Sharing & Phone Calls**: Intercepts `wa.me` and `tel:` links to launch WhatsApp and Phone dialer natively.
- **Obsidian Dark Mode System Bars**: Colors the Android status bar and navigation bar to `#090D16`.

---

## 🛠️ Method 1: Build the APK Locally (Using Flutter CLI)

### Prerequisites:
If Flutter is not already installed on your computer:
1. Download Flutter from [flutter.dev](https://docs.flutter.dev/get-started/install/windows).
2. Extract to `C:\flutter` and add `C:\flutter\bin` to your Windows Environment `PATH`.

### Build Steps:
1. Open PowerShell or Terminal in the project root:
   ```powershell
   cd c:\Users\Kubera\OneDrive\Desktop\app\flutter_app
   ```
2. Fetch required dependencies:
   ```powershell
   flutter pub get
   ```
3. Compile the release APK:
   ```powershell
   flutter build apk --release
   ```
   *(Or for debug testing: `flutter build apk --debug`)*

4. Your completed APK will be located at:
   ```text
   flutter_app/build/app/outputs/flutter-apk/app-release.apk
   ```

5. Copy `app-release.apk` to your phone via USB, Google Drive, or WhatsApp, and tap to install!

---

## ☁️ Method 2: 1-Click Cloud APK Build (Free via GitHub Actions — No Local Setup!)

You don't even need to install Flutter or the Android SDK on your PC! A GitHub Actions workflow has been configured at [`.github/workflows/build_flutter_apk.yml`](file:///c:/Users/Kubera/OneDrive/Desktop/app/.github/workflows/build_flutter_apk.yml).

1. Push this project to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add Flutter APK project"
   git push origin main
   ```
2. Go to your repository on GitHub in your browser.
3. Click on the **Actions** tab.
4. Click on **Build Flutter APK** $\rightarrow$ **Run workflow**.
5. When it finishes (~2 minutes), click on the completed run and download **`SriMoorthyFleet-Release-APK`**.
6. Extract the zip file to get `app-release.apk` ready to install on any Android phone!

---

## 🔄 Keeping Web Assets Synced
Whenever you make updates to [`index.html`](file:///c:/Users/Kubera/OneDrive/Desktop/app/index.html), [`style.css`](file:///c:/Users/Kubera/OneDrive/Desktop/app/style.css), or [`app.js`](file:///c:/Users/Kubera/OneDrive/Desktop/app/app.js), simply run:

```powershell
python sync_flutter_assets.py
```

This copies the latest files directly into `flutter_app/assets/web/`.
