import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUMMARY_PROMPT = """Analyze the following meeting transcript and provide a structured summary with these sections:
1. Meeting Name
2. Session Summary (brief overview)
3. Key Items & Decisions
4. Immediate Action Items
5. Next Steps

Keep the summary concise but comprehensive. Format as JSON."""

def transcribe_audio(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1", file=f, response_format="text"
        )
    return transcript

def generate_summary(transcript_text: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": transcript_text},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)
