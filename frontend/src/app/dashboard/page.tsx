"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, FileText, Mic, Clock, Trash2, ExternalLink, Loader2 } from "lucide-react";

interface Meeting { id: string; title: string; duration_minutes: number; status: string; created_at: string; }

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState("");
  const [usage, setUsage] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("token")) return void router.push("/login");
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [m, u] = await Promise.all([api.getMeetings(), api.getUsage()]);
      setMeetings(m);
      setUsage(u);
    } catch { /* token might be invalid */ } finally { setLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.transcribe(file, file.name.replace(/\.[^.]+$/, ""));
      toast.success("Transcription complete");
      router.push(`/meetings/${data.meeting_id}`);
    } catch (err: any) {
      toast.error(err.message);
      loadData();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    setUploading(true);
    try {
      const data = await api.transcribeText(text);
      toast.success("Saved");
      router.push(`/meetings/${data.meeting_id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: string) => {
    try {
      await api.deleteMeeting(id);
      setMeetings(meetings.filter((m) => m.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {usage && (
            <p className="text-sm text-gray-500">
              {usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1)} plan &middot; {Math.round(usage.minutes_used)} / {usage.minutes_limit} minutes used
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="font-semibold mb-4">New Meeting</h2>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTextMode(false)} className={`px-4 py-2 rounded-lg text-sm ${!textMode ? "bg-blue-600 text-white" : "bg-gray-100"}`}><Upload className="w-4 h-4 inline mr-1" />Upload Audio</button>
          <button onClick={() => setTextMode(true)} className={`px-4 py-2 rounded-lg text-sm ${textMode ? "bg-blue-600 text-white" : "bg-gray-100"}`}><FileText className="w-4 h-4 inline mr-1" />Paste Text</button>
        </div>
        {textMode ? (
          <div className="space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your meeting transcript or notes here..." className="w-full border border-gray-300 rounded-lg p-3 text-sm h-32 resize-none" />
            <button onClick={handleTextSubmit} disabled={uploading || !text.trim()} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {uploading ? "Saving..." : "Save Text"}
            </button>
          </div>
        ) : (
          <div>
            <label className={`flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 ${uploading ? "opacity-50" : ""}`}>
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">{uploading ? "Transcribing..." : "Click to upload audio file"}</p>
                <p className="text-xs text-gray-400 mt-1">MP3, WAV, M4A, MP4, WebM (max 25MB)</p>
              </div>
              <input type="file" accept="audio/*,video/*" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        )}
      </div>

      <h2 className="font-semibold mb-3">Recent Meetings</h2>
      {meetings.length === 0 ? (
        <p className="text-gray-500 text-sm">No meetings yet. Upload or paste one above.</p>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between hover:shadow-sm">
              <Link href={`/meetings/${m.id}`} className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.title}</p>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3" />{m.duration_minutes.toFixed(1)} min &middot; {new Date(m.created_at).toLocaleDateString()}
                </p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/meetings/${m.id}`} className="text-gray-400 hover:text-blue-600"><ExternalLink className="w-4 h-4" /></Link>
                <button onClick={() => del(m.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
