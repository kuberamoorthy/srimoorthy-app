"""
Sync script to copy web application assets into the Android native project assets folder.
Usage: python copy_assets.py
"""

import os
import shutil

src_files = ['index.html', 'style.css', 'app.js', 'manifest.json', 'sw.js']
dest_dir = os.path.join('android', 'app', 'src', 'main', 'assets')

os.makedirs(dest_dir, exist_ok=True)

print("Syncing assets to Android project...")
for filename in src_files:
    if os.path.exists(filename):
        shutil.copy2(filename, os.path.join(dest_dir, filename))
        size = os.path.getsize(filename)
        print(f"  [OK] Copied {filename} ({size:,} bytes)")
    else:
        print(f"  [WARN] Missing {filename}")

print(f"\nDone! Assets are ready in {dest_dir}")
