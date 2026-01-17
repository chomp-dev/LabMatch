try:
    import fastapi
    import uvicorn
    import httpcore
    print("Imports successful")
except Exception as e:
    print(f"Import failed: {e}")
