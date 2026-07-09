"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, FileText } from "lucide-react";
import Link from "next/link";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) return void router.push("/login");
    load();
  }, [id]);

  const load = async () => {
    try {
      const m = await api.getMeeting(id);
      setData(m);
      setTitle(m.title);
    } catch { router.push("/dashboard"); } finally { setLoading(false); }
  };

  const summarize = async () => {
    setSummarizing(true);
    try {
      await api.summarize(id);
      toast.success("Summary generated");
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSummarizing(false); }
  };

  const saveTitle = async () => {
    try {
      await api.updateTitle(id, title);
      toast.success("Title updated");
    } catch { toast.error("Failed to update title"); }
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  if (!data) return null;

  return (
    <div className="max-4xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none flex-1"
        />
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{data.status}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Transcript</h2>
          {data.transcripts?.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.transcripts.map((t: any) => (
                <div key={t.id} className="text-sm">
                  {t.speaker && <span className="font-medium text-blue-600">{t.speaker}: </span>}
                  <span className="text-gray-700">{t.text}</span>
                  {t.timestamp != null && <span className="text-xs text-gray-400 ml-2">[{t.timestamp.toFixed(1)}s]</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No transcript available.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Summary</h2>
            {!data.summary && (
              <button onClick={summarize} disabled={summarizing} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {summarizing ? "Generating..." : "Generate"}
              </button>
            )}
          </div>
          {data.summary ? (
            <div className="text-sm text-gray-700 prose prose-sm max-w-none whitespace-pre-wrap max-h-96 overflow-y-auto">
              {data.summary.summary_text}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No summary yet. Click Generate to create an AI summary.</p>
          )}
        </div>
      </div>
    </div>
  );
}
