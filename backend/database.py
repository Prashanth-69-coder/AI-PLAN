
import os
from sqlmodel import Session, create_engine, SQLModel

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trip_planner.db")
engine = create_engine(DATABASE_URL, echo=False)

def init_db() -> None:
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
