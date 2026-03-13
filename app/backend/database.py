import logging
import sqlite3
import subprocess
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from config import DATABASE_PATH

log = logging.getLogger("database")

# Serialize all writes within this process so only one thread writes at a time.
# External processes (sqlite3 CLI, agents) contend at the SQLite level where
# busy_timeout handles retries.
_write_lock = threading.Lock()


def get_db() -> sqlite3.Connection:
    """Get a database connection with WAL mode and optimized settings."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA journal_size_limit=67108864")
    return conn


@contextmanager
def get_db_connection(readonly: bool = False):
    """Context manager for database connections. Ensures cleanup on exit.

    Usage:
        with get_db_connection() as db:
            db.execute("INSERT ...")
            db.commit()

        with get_db_connection(readonly=True) as db:
            rows = db.execute("SELECT ...").fetchall()
    """
    conn = get_db()
    try:
        yield conn
    except Exception:
        if not readonly:
            conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_write_db():
    """Acquire the process-wide write lock, then yield a connection.

    Ensures only one Python thread writes at a time, keeping lock windows
    short so external processes can interleave their writes.
    """
    with _write_lock:
        conn = get_db()
        try:
            yield conn
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def batch_upsert(db: sqlite3.Connection, sql: str, rows: list, batch_size: int = 50):
    """Execute INSERT/REPLACE in batches, committing after each batch.

    Keeps write lock duration short (~50 rows at a time) so external
    processes and other threads can interleave their writes.
    Retries each batch up to 3 times on SQLITE_BUSY.
    """
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        for attempt in range(3):
            try:
                db.executemany(sql, batch)
                db.commit()
                break
            except sqlite3.OperationalError as e:
                if "locked" not in str(e).lower() and "busy" not in str(e).lower():
                    raise
                if attempt == 2:
                    raise
                time.sleep(0.1 * (2**attempt))


def run_migrations():
    """Run Alembic migrations to upgrade database to latest version."""
    from config import get_backend_root, is_bundled

    backend_dir = get_backend_root()
    alembic_ini = backend_dir / "alembic.ini"

    log.info("Database path: %s", DATABASE_PATH)
    log.info("Database exists: %s", DATABASE_PATH.exists())
    if DATABASE_PATH.exists():
        log.info("Database size: %d bytes", DATABASE_PATH.stat().st_size)
    log.info("Alembic config: %s (exists=%s)", alembic_ini, alembic_ini.exists())
    log.info("Backend dir: %s", backend_dir)
    log.info("Bundled mode: %s", is_bundled())

    if not alembic_ini.exists():
        raise FileNotFoundError(f"Alembic config not found at {alembic_ini}")

    # Ensure database directory exists
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    if is_bundled():
        # In PyInstaller bundle, use Alembic Python API (no CLI binary available)
        alembic_dir = backend_dir / "alembic"
        log.info("Alembic dir: %s (exists=%s)", alembic_dir, alembic_dir.exists())
        if alembic_dir.exists():
            versions_dir = alembic_dir / "versions"
            if versions_dir.exists():
                migrations = list(versions_dir.glob("*.py"))
                log.info("Found %d migration files in %s", len(migrations), versions_dir)

        from alembic.config import Config

        from alembic import command

        cfg = Config(str(alembic_ini))
        cfg.set_main_option("script_location", str(alembic_dir))
        log.info("Running Alembic upgrade to head...")
        command.upgrade(cfg, "head")
        log.info("Database migrations completed successfully")
    else:
        # Development mode: use alembic CLI
        import sys

        alembic_path = Path(sys.executable).parent / "alembic"
        if not alembic_path.exists():
            alembic_path = "alembic"

        log.info("Running alembic CLI: %s", alembic_path)
        result = subprocess.run(
            [str(alembic_path), "-c", str(alembic_ini), "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            log.error("Migration stderr: %s", result.stderr)
            raise RuntimeError(f"Database migration failed: {result.stderr}")

        if result.stdout:
            log.info("Migration stdout: %s", result.stdout.strip())
        log.info("Database migrations completed successfully")

    # Log current schema version
    try:
        conn = get_db()
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        log.info("Current schema version: %s", row[0] if row else "NONE")
        conn.close()
    except Exception as e:
        log.warning("Could not read schema version: %s", e)


def init_db():
    """Initialize database and run all migrations."""
    log.info("Initializing database...")
    run_migrations()


# FTS (Full-Text Search) helper functions
FTS_TABLES = [
    "fts_people",
    "fts_notes",
    "fts_granola",
    "fts_meeting_files",
    "fts_one_on_one",
    "fts_issues",
    "fts_emails",
    "fts_drive_files",
    "fts_google_sheets",
    "fts_google_docs",
    "fts_longform",
    "fts_meeting_notes_ext",
    "fts_memory",
]


def rebuild_fts():
    """Rebuild all FTS5 indexes from source tables."""
    with get_db_connection() as conn:
        for table in FTS_TABLES:
            try:
                # table comes from the hardcoded FTS_TABLES list, not user input
                assert table in FTS_TABLES
                conn.execute(f"INSERT INTO {table}({table}) VALUES('rebuild')")
            except sqlite3.OperationalError:
                # Table doesn't exist yet, skip
                pass
        conn.commit()


def rebuild_fts_table(table_name: str):
    """Rebuild a single FTS5 index."""
    if table_name not in FTS_TABLES:
        raise ValueError(f"Unknown FTS table: {table_name}")

    with get_db_connection() as conn:
        try:
            conn.execute(f"INSERT INTO {table_name}({table_name}) VALUES('rebuild')")
            conn.commit()
        except sqlite3.OperationalError as e:
            print(f"Failed to rebuild {table_name}: {e}")
