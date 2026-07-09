"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

interface Plan { name: string; minutes: number; price_monthly: number; plan_id: string | null; }

function PricingContent() {
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [currentTier, setCurrentTier] = useState("free");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") toast.success("Subscription activated!");
    if (searchParams.get("limit") === "true") toast.error("You hit your monthly limit. Upgrade to continue.");
    load();
  }, []);

  const load = async () => {
    try {
      const [p, u] = await Promise.all([api.getPlans(), api.getUsage().catch(() => null)]);
      setPlans(p);
      if (u) setCurrentTier(u.tier);
    } catch {} finally { setLoading(false); }
  };

  const subscribe = async (planId: string, tier: string) => {
    if (tier === currentTier) return;
    if (!localStorage.getItem("token")) return void router.push("/login");
    setCheckingOut(tier);
    try {
      const data = await api.createPaypalSubscription(planId);
      window.location.href = data.approval_url;
    } catch (err: any) { toast.error(err.message); setCheckingOut(null); }
  };

  const openPortal = async () => {
    // PayPal no hosted portal — redirect to PayPal directly
    window.open("https://www.paypal.com/myaccount/autopay/", "_blank");
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  const tiers: Record<string, { btnClass: string; features: string[] }> = {
    free: { btnClass: "bg-gray-600 hover:bg-gray-700", features: ["10 minutes/month", "Upload audio files", "AI transcription", "Basic summaries"] },
    pro: { btnClass: "bg-blue-600 hover:bg-blue-700", features: ["600 minutes/month (10 hrs)", "Upload audio files", "AI transcription", "GPT-4o summaries", "Priority processing", "Export to Markdown/PDF"] },
    team: { btnClass: "bg-purple-600 hover:bg-purple-700", features: ["3000 minutes/month (50 hrs)", "Everything in Pro", "Team sharing", "Higher priority", "Custom prompts", "API access"] },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Simple Pricing</h1>
        <p className="text-gray-600">Pay for what you use. No hidden fees.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(plans).map(([key, plan]) => {
          const t = tiers[key] || { btnClass: "bg-gray-600 hover:bg-gray-700", features: [] };
          return (
            <div key={key} className={`bg-white border-2 rounded-xl p-6 flex flex-col ${currentTier === key ? "border-blue-500" : "border-gray-200"}`}>
              <h3 className="text-lg font-bold capitalize">{plan.name}</h3>
              <p className="text-3xl font-bold mt-2">${(plan.price_monthly / 100).toFixed(2)}<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <p className="text-sm text-gray-500 mt-1">{plan.minutes} minutes/month</p>
              <ul className="mt-6 space-y-2 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="text-sm flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              {key === currentTier ? (
                <button onClick={openPortal} className="mt-6 w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Manage Subscription
                </button>
              ) : plan.plan_id ? (
                <button onClick={() => subscribe(plan.plan_id!, key)} disabled={checkingOut === key} className={`mt-6 w-full ${t.btnClass} text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50`}>
                  {checkingOut === key ? "Redirecting..." : currentTier === "free" ? "Upgrade" : "Switch Plan"}
                </button>
              ) : (
                <p className="mt-6 text-center text-sm text-gray-500">Current plan</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}>
      <PricingContent />
    </Suspense>
  );
}
