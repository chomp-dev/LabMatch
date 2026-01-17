from services.supabase_client import get_supabase_client

def list_users():
    supabase = get_supabase_client()
    try:
        # Try to list users using admin api if accessible
        users = supabase.auth.admin.list_users()
        print("Found users:")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}")
            
    except Exception as e:
        print(f"Error listing users: {e}")
        # If admin api fails, try to fetch from profiles directly to see what IDs are there
        try:
            profiles = supabase.table("profiles").select("*").execute()
            print("\nProfiles found:")
            for p in profiles.data:
                print(f"ID: {p['id']}, Name: {p.get('name')}")
        except Exception as e2:
             print(f"Error listing profiles: {e2}")

if __name__ == "__main__":
    list_users()
