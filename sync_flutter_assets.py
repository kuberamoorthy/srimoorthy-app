import os
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FLUTTER_WEB_ASSETS = os.path.join(ROOT_DIR, 'flutter_app', 'assets', 'web')

FILES_TO_SYNC = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'sw.js'
]

def sync_assets():
    os.makedirs(FLUTTER_WEB_ASSETS, exist_ok=True)
    print("Syncing web assets to Flutter assets/web directory...")

    for fname in FILES_TO_SYNC:
        src = os.path.join(ROOT_DIR, fname)
        dst = os.path.join(FLUTTER_WEB_ASSETS, fname)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            size = os.path.getsize(dst)
            print(f"  [OK] Copied {fname} ({size:,} bytes)")
        else:
            print(f"  [WARN] Source file missing: {fname}")

    print("\nAssets synced successfully into flutter_app/assets/web!")

if __name__ == '__main__':
    sync_assets()
