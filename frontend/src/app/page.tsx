"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Upload, FileText, Sparkles, Lock, ArrowRight } from "lucide-react";

export default function Landing() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(localStorage.getItem("token")); }, []);

  return (
    <div>
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          AI-Powered <span className="text-blue-600">Meeting Intelligence</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Transcribe, summarize, and extract insights from your meetings automatically.
          Privacy-first, powered by OpenAI.
        </p>
        <Link
          href={token ? "/dashboard" : "/register"}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-lg font-medium hover:bg-blue-700"
        >
          {token ? "Go to Dashboard" : "Get Started Free"} <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section className="max-5xl mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Upload, title: "Upload Audio", desc: "Upload meeting recordings in any format. MP3, WAV, M4A, and more." },
            { icon: FileText, title: "AI Transcription", desc: "Accurate transcription powered by OpenAI Whisper with speaker detection." },
            { icon: Sparkles, title: "Smart Summaries", desc: "GPT-powered summaries with action items, decisions, and next steps." },
            { icon: Mic, title: "Live Recording", desc: "Record meetings directly in the browser with real-time transcription." },
            { icon: Lock, title: "Privacy First", desc: "Your data is encrypted and secure. You retain full ownership." },
            { icon: ArrowRight, title: "Export & Share", desc: "Export transcripts and summaries in Markdown, PDF, or share with your team." },
          ].map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm">
              <f.icon className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
