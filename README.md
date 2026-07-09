# Meetily Web - AI Meeting Assistant (Paid SaaS)

웹 기반 AI 회의 도우미 — OpenAI Whisper로 자동 변환, GPT로 요약.

## Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env   # edit with your keys
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Frontend
cd frontend
npm install
npx next dev -p 3000
```

Or with Docker:
```bash
docker-compose up --build
```

## Environment Variables (.env)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (Whisper + GPT) |
| `SECRET_KEY` | JWT signing secret |
| `PAYPAL_CLIENT_ID` | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal REST API secret |
| `PAYPAL_PRO_PLAN_ID` | PayPal Pro $19.99 plan ID |
| `PAYPAL_TEAM_PLAN_ID` | PayPal Team $49.99 plan ID |

## API Endpoints

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/meetings` - List meetings
- `POST /api/transcribe` - Upload audio for transcription
- `POST /api/transcribe/text` - Save text transcript
- `POST /api/summarize/{id}` - Generate AI summary
- `POST /api/stripe/create-checkout` - Create subscription
- `GET /api/plans` - List pricing plans

## Pricing Tiers

| Plan | Minutes | Price |
|---|---|---|
| Free | 10/mo | $0 |
| Pro | 600/mo (10h) | $19.99 |
| Team | 3000/mo (50h) | $49.99 |
