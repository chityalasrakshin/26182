import sqlite3
import os

db_path = "data/crypto_trace.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print("Tables:", tables)
    for t in tables[:10]:
        count = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t}: {count} rows")
        sample = cur.execute(f"SELECT * FROM {t} LIMIT 2").fetchall()
        print(f"    sample: {sample}")

candidates_dir = "data/candidates"
if os.path.exists(candidates_dir):
    print("Candidates files:", os.listdir(candidates_dir))
