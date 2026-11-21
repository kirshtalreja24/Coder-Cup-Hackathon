from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import get_settings, normalized_db_url

settings = get_settings()
_url = normalized_db_url(settings.database_url)
_kwargs = (
    {"connect_args": {"check_same_thread": False}}
    if _url.startswith("sqlite")
    else {"pool_pre_ping": False, "pool_recycle": 180, "pool_size": 5}  # no extra "SELECT 1" per checkout (a whole round trip on a far database); recycle before the pooler drops idle connections
)
engine = create_engine(_url, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
