import os
frontend = "http://localhost:8080"
DB_HOST = "mongo"
DB_PORT = 27017
DB_NAME = "p2t2"
COLLECTION_NAME = "transcripts"
if os.environ.get("FLASK_ENV") != "development":
    DB_HOST = "127.0.0.1"
    frontend = "http://p2t2.hmgc.mcw.edu"