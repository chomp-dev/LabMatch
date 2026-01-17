from services.supabase_client import get_supabase_client
import uuid

def create_user():
    supabase = get_supabase_client()
    email = "test@example.com"
    password = "password123"
    
    print(f"Creating user {email}...")
    try:
        # 1. Sign up user (creates auth.users entry)
        # Using sign_up usually requires email confirmation unless disabled.
        # Alternatively, admin.create_user auto-confirms execution.
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        
        user = res.user
        print(f"User created with ID: {user.id}")
        
        # 2. Create Profile (if not handled by trigger)
        # Check if profile exists
        profile_res = supabase.table("profiles").select("*").eq("id", user.id).execute()
        if not profile_res.data:
            print("Creating profile...")
            profile_data = {
                "id": user.id,
                "name": "Test User",
                "school": "UIUC",
                "major": "CS"
            }
            supabase.table("profiles").insert(profile_data).execute()
            print("Profile created.")
        else:
            print("Profile already exists.")
            
        return user.id

    except Exception as e:
        print(f"Error creating user: {e}")
        return None

if __name__ == "__main__":
    create_user()
