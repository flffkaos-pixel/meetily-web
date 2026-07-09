import os
import io
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from openai import OpenAI

from .database import init_db, get_db
from .models import User, Meeting, Transcript, Summary
from .auth import hash_password, verify_password, create_access_token, get_current_user
from .paypal_service import create_subscription, get_subscription, cancel_subscription

PLANS = {
    "free":  {"name": "Free",  "minutes": 10,  "price_monthly": 0,    "plan_id": None},
    "pro":   {"name": "Pro",   "minutes": 600,  "price_monthly": 1999, "plan_id": os.getenv("PAYPAL_PRO_PLAN_ID")},
    "team":  {"name": "Team",  "minutes": 3000, "price_monthly": 4999, "plan_id": os.getenv("PAYPAL_TEAM_PLAN_ID")},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Meetily API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.on_event("startup")
def startup():
    init_db()

# --- Auth ---

@app.post("/api/auth/register")
def register(email: str = Form(...), password: str = Form(...), name: Optional[str] = Form(None), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    user = User(id=None, email=email, password_hash=hash_password(password), name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "tier": user.subscription_tier}}

@app.post("/api/auth/login")
def login(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token(user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "tier": user.subscription_tier}}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "tier": user.subscription_tier,
            "minutes_used": user.minutes_used, "minutes_limit": user.minutes_limit}

# --- PayPal ---

@app.post("/api/paypal/create-subscription")
async def create_paypal_subscription(plan_id: str = Form(...), user: User = Depends(get_current_user)):
    tier = next((k for k, v in PLANS.items() if v["plan_id"] == plan_id), None)
    if not tier:
        raise HTTPException(400, "Invalid plan")
    return_url = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/api/paypal/return"
    cancel_url = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/pricing"
    try:
        sub_id, approval_url = await create_subscription(plan_id, return_url, cancel_url)
    except Exception as e:
        raise HTTPException(502, f"PayPal error: {str(e)}")
    return {"subscription_id": sub_id, "approval_url": approval_url}

@app.get("/api/paypal/return")
async def paypal_return(token: str = "", db: Session = Depends(get_db)):
    # token = PayPal subscription_id after approval
    if not token:
        raise HTTPException(400, "Missing subscription token")
    try:
        sub = await get_subscription(token)
    except Exception as e:
        raise HTTPException(502, f"PayPal error: {str(e)}")
    status = sub.get("status", "")
    plan_id = sub.get("plan_id", "")
    # Find user by their active PayPal subscription — we don't have user context in redirect
    # So we store sub_id -> user mapping during creation (we can use a cache or DB column)
    user = db.query(User).filter(User.stripe_subscription_id == token).first()
    if user and status == "ACTIVE":
        tier = next((k for k, v in PLANS.items() if v["plan_id"] == plan_id), "pro")
        user.subscription_tier = tier
        user.subscription_status = "active"
        user.minutes_limit = PLANS[tier]["minutes"]
        db.commit()
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=os.getenv("FRONTEND_URL", "http://localhost:3000") + "/dashboard?subscribed=true")

@app.post("/api/paypal/webhook")
async def paypal_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    event_type = body.get("event_type", "")
    resource = body.get("resource", {})
    if event_type in ("BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED"):
        sub_id = resource.get("id")
        plan_id = resource.get("plan_id", "")
        status = resource.get("status", "")
        # We need user context — store sub_id in User model during creation
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            user.subscription_status = status.lower() if status else "active"
            if status == "ACTIVE":
                tier = next((k for k, v in PLANS.items() if v["plan_id"] == plan_id), "pro")
                user.subscription_tier = tier
                user.minutes_limit = PLANS[tier]["minutes"]
            elif status in ("CANCELLED", "SUSPENDED", "EXPIRED"):
                user.subscription_tier = "free"
                user.minutes_limit = PLANS["free"]["minutes"]
                user.subscription_status = "canceled"
            db.commit()
    return {"ok": True}

@app.post("/api/paypal/cancel")
async def cancel_paypal_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.stripe_subscription_id:
        raise HTTPException(400, "No subscription")
    try:
        await cancel_subscription(user.stripe_subscription_id)
    except Exception as e:
        raise HTTPException(502, f"PayPal error: {str(e)}")
    user.subscription_tier = "free"
    user.subscription_status = "canceled"
    user.minutes_limit = PLANS["free"]["minutes"]
    db.commit()
    return {"ok": True}

# --- Meetings ---

@app.get("/api/meetings")
def list_meetings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meetings = db.query(Meeting).filter(Meeting.user_id == user.id).order_by(Meeting.created_at.desc()).all()
    return [{"id": m.id, "title": m.title, "duration_minutes": m.duration_minutes,
             "status": m.status, "created_at": m.created_at.isoformat()} for m in meetings]

@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user.id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    transcripts = [{"id": t.id, "text": t.text, "speaker": t.speaker, "timestamp": t.timestamp} for t in meeting.transcripts]
    summary = None
    if meeting.summary:
        summary = {"summary_text": meeting.summary.summary_text, "action_items": meeting.summary.action_items, "content": meeting.summary.content}
    return {"id": meeting.id, "title": meeting.title, "status": meeting.status,
            "duration_minutes": meeting.duration_minutes, "created_at": meeting.created_at.isoformat(),
            "transcripts": transcripts, "summary": summary}

@app.delete("/api/meetings/{meeting_id}")
def delete_meeting(meeting_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user.id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    db.delete(meeting)
    db.commit()
    return {"ok": True}

@app.put("/api/meetings/{meeting_id}/title")
def update_title(meeting_id: str, title: str = Form(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user.id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    meeting.title = title
    db.commit()
    return {"ok": True}

# --- Transcription ---

def check_usage(user: User, duration_minutes: float):
    if user.minutes_used + duration_minutes > user.minutes_limit:
        raise HTTPException(402, f"Monthly limit reached ({user.minutes_limit} min). Upgrade to continue.")
    user.minutes_used += duration_minutes

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...), meeting_title: Optional[str] = Form("Untitled Meeting"),
                           user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = await file.read()
    # OpenAI Whisper API: max 25MB, supports mp3/mp4/mpeg/mpga/m4a/wav/webm
    try:
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=io.BytesIO(content),
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")

    duration = getattr(transcript, "duration", 0) or 0
    check_usage(user, duration / 60)

    meeting = Meeting(id=None, user_id=user.id, title=meeting_title, duration_minutes=duration / 60, status="completed")
    db.add(meeting)
    db.commit()

    for seg in getattr(transcript, "segments", []):
        db.add(Transcript(meeting_id=meeting.id, text=seg.text, speaker=None, timestamp=seg.start))
    db.commit()

    return {"meeting_id": meeting.id, "duration_minutes": duration / 60, "text": transcript.text}

@app.post("/api/transcribe/text")
async def transcribe_text(text: str = Form(...), language: Optional[str] = Form(None),
                          meeting_title: Optional[str] = Form("Untitled Meeting"),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    duration = max(1.0, len(text.split()) / 150)  # rough estimate
    check_usage(user, duration / 60)

    meeting = Meeting(id=None, user_id=user.id, title=meeting_title, duration_minutes=duration / 60, status="completed")
    db.add(meeting)
    db.commit()
    db.add(Transcript(meeting_id=meeting.id, text=text, speaker=None, timestamp=0.0))
    db.commit()
    return {"meeting_id": meeting.id, "duration_minutes": duration / 60}

# --- Summarization ---

@app.post("/api/summarize/{meeting_id}")
async def summarize_meeting(meeting_id: str, custom_prompt: Optional[str] = Form(None),
                            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user.id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    transcript_text = "\n".join([t.text for t in meeting.transcripts])
    if not transcript_text.strip():
        raise HTTPException(400, "No transcript to summarize")

    prompt = custom_prompt or (
        "Summarize the following meeting transcript. Include:\n"
        "1. Session Summary (key discussion points)\n"
        "2. Key Items & Decisions\n"
        "3. Action Items (with owners if mentioned)\n"
        "4. Next Steps\n\n"
        f"Transcript:\n{transcript_text}"
    )

    try:
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        summary_text = resp.choices[0].message.content
    except Exception as e:
        raise HTTPException(500, f"Summarization failed: {str(e)}")

    existing = db.query(Summary).filter(Summary.meeting_id == meeting_id).first()
    if existing:
        existing.summary_text = summary_text
    else:
        db.add(Summary(meeting_id=meeting_id, summary_text=summary_text))
    db.commit()
    return {"summary": summary_text}

# --- Usage ---

@app.get("/api/usage")
def get_usage(user: User = Depends(get_current_user)):
    return {
        "tier": user.subscription_tier,
        "minutes_used": user.minutes_used,
        "minutes_limit": user.minutes_limit,
        "subscription_status": user.subscription_status,
    }

@app.get("/api/plans")
def get_plans():
    return PLANS
