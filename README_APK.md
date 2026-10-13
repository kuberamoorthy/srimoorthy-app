# 📱 How to Convert & Install Sri Moorthy Fleet as an Android App (APK)

This project is a modern Progressive Web App (PWA) with full offline caching, Supabase database synchronization, and GPS fleet tracking. You can install it on your Android phone using **any of the methods below**.

---

## ⚡ Method 1: Instant 1-Tap Install on Android Phone (Recommended — 10 Seconds)
You do not need to download or compile any APK file! Android Chrome natively installs the app directly onto your phone drawer with the Sri Moorthy Transport icon and standalone fullscreen mode.

1. **Connect your phone to the same Wi-Fi** as this computer.
2. Open Google Chrome on your phone and go to:
   ```text
   http://192.168.1.6:3000
   ```
   *(Or scan the QR code from the in-app "Install App / APK" button)*
3. In Chrome, tap the **3 vertical dots menu (⋮)** in the top right corner.
4. Tap **"Install app"** (or **"Add to Home screen"**).
5. Tap **"Install"**.
6. The app is installed on your phone! It opens full-screen like a native app without any browser URL bar and works offline.

---

## 📦 Method 2: Generate Standalone `.apk` File via PWABuilder (1-Click Online)
If you want an actual `.apk` installer file to share over WhatsApp or Google Drive:

1. Deploy your app or use your live URL (e.g., `https://srimoorthy.vercel.app`).
2. Go to [PWABuilder.com](https://www.pwabuilder.com).
3. Paste the URL and click **"Start"**.
4. Click **"Package for Android"**.
5. Click **"Download Package / APK"**.
6. You will receive a signed `.apk` file ready to install on any Android phone!

---

## 🛠️ Method 3: Pre-Configured Android Studio Project (`android/`)
We have already generated a complete native Android project in this repository:
- **Location:** `c:\Users\Kubera\OneDrive\Desktop\app\android\`
- **Package Name:** `com.srimoorthy.fleet`
- **Features:**
  - Full offline bundled assets in `android/app/src/main/assets/`
  - High-performance WebView with hardware acceleration
  - Camera & photo gallery permissions for bill attachments and odometer logging
  - Hardware back-button navigation

### How to Build the APK:
1. Open **Android Studio**.
2. Select **Open an Existing Project** and choose the `android/` folder.
3. Wait for Gradle sync to complete.
4. Click **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)**.
5. Android Studio will produce:
   ```text
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
6. Copy `app-debug.apk` to your phone and tap to install!

---

## 🔄 Updating Web Assets in the Android Project
Whenever you change `index.html`, `style.css`, or `app.js`, update the offline Android assets by running:
```bash
python copy_assets.py
```
This syncs your latest edits straight into `android/app/src/main/assets/`.
