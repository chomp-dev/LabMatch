import os
import requests
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

class QueryBuilder:
    def __init__(self, base_url, headers, table):
        self.url = f"{base_url}/rest/v1/{table}"
        self.headers = headers.copy()
        self.params = {}
        self.method = "GET"
        self.json_data = None

    def select(self, columns="*"):
        self.method = "GET"
        self.params["select"] = columns
        return self

    def insert(self, data):
        self.method = "POST"
        self.headers["Prefer"] = "return=representation"
        self.json_data = data
        return self

    def update(self, data):
        self.method = "PATCH"
        self.headers["Prefer"] = "return=representation"
        self.json_data = data
        return self

    def eq(self, column, value):
        self.params[f"{column}"] = f"eq.{value}"
        return self

    def execute(self):
        try:
            if self.method == "GET":
                r = requests.get(self.url, headers=self.headers, params=self.params)
            elif self.method == "POST":
                r = requests.post(self.url, headers=self.headers, json=self.json_data, params=self.params)
            elif self.method == "PATCH":
                r = requests.patch(self.url, headers=self.headers, json=self.json_data, params=self.params)
            
            r.raise_for_status()
            return type('Response', (), {'data': r.json()})
        except Exception as e:
            print(f"Supabase Request Failed: {e}")
            # print(r.text) # Debugging
            # Return empty data on failure to match broad expectations or raise? 
            # Raising is better so we know it failed.
            raise e

class SimpleSupabaseClient:
    def __init__(self, url, key):
        self.base_url = url.rstrip("/")
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

    def table(self, name):
         return QueryBuilder(self.base_url, self.headers, name)

# Initialize the lightweight client
try:
    if not url or not key:
        print("Warning: SUPABASE_URL or KEY missing.")
    
    if "hvbmmywuurmbvnhqirep" in url:
        print("\n" + "="*80)
        print("CRITICAL: You are using a placeholder Supabase URL.") 
        print("Please update backend/.env with your actual Supabase project URL.")
        print("The current value 'hvbmmywuurmbvnhqirep' is invalid and will cause connection errors.")
        print("="*80 + "\n")

    supabase = SimpleSupabaseClient(url, key)
except Exception as e:
    print(f"Supabase init failed: {e}")
    supabase = None

def get_supabase_client():
    return supabase
