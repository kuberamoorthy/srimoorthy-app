import urllib.request
import urllib.parse
import json

SUPABASE_URL = "https://gusrwwwoammurxzwywmy.supabase.co"
SUPABASE_KEY = "sb_publishable_hXTr_LSTHmmUcgVk3Y42tA_2VDN6WBU"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def delete_table_records(table_name):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?id=neq.00000000-0000-0000-0000-000000000000"
    req = urllib.request.Request(url, headers=HEADERS, method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[OK] Cleared all records from table '{table_name}' (HTTP {resp.status})")
            return True
    except Exception as e:
        print(f"[INFO] Table '{table_name}': {e}")
        return False

def reset_vehicles():
    default_vehicles = [
        {"name": "TATA ACE", "number": "TN68C6003", "type": "TATA ACE", "color": "#EF5226", "status": "active"},
        {"name": "TATA ACE", "number": "TN68W2419", "type": "TATA ACE", "color": "#3b82f6", "status": "active"},
        {"name": "DOST+", "number": "TN82K1945", "type": "DOST+", "color": "#10b981", "status": "active"}
    ]
    url = f"{SUPABASE_URL}/rest/v1/vehicles"
    data = json.dumps(default_vehicles).encode('utf-8')
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[OK] Seeded default 3 vehicles into Supabase (HTTP {resp.status})")
    except Exception as e:
        print(f"[INFO] Vehicles seed: {e}")

if __name__ == "__main__":
    print("Resetting Sri Moorthy Transport Supabase Database...")
    delete_table_records("bills")
    delete_table_records("fuel_logs")
    reset_vehicles()
    print("Database reset completed successfully!")
