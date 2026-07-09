import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    subscription_tier = Column(String, default="free")  # free, pro, team
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, default="inactive")  # inactive, active, past_due, canceled
    minutes_used = Column(Float, default=0.0)  # monthly usage
    minutes_limit = Column(Float, default=60.0)
    created_at = Column(DateTime, default=utcnow)

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Untitled Meeting")
    duration_minutes = Column(Float, default=0.0)
    status = Column(String, default="processing")  # processing, completed, failed
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    transcripts = relationship("Transcript", back_populates="meeting", cascade="all, delete-orphan")
    summary = relationship("Summary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")

class Transcript(Base):
    __tablename__ = "transcripts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    text = Column(Text, nullable=False)
    speaker = Column(String, nullable=True)
    timestamp = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    meeting = relationship("Meeting", back_populates="transcripts")

class Summary(Base):
    __tablename__ = "summaries"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, unique=True)
    content = Column(JSON, nullable=True)
    summary_text = Column(Text, nullable=True)
    action_items = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    meeting = relationship("Meeting", back_populates="summary")
