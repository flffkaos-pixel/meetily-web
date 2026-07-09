import os, httpx

CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
API_BASE = "https://api-m.sandbox.paypal.com"

async def get_token():
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{API_BASE}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(CLIENT_ID, CLIENT_SECRET),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        r.raise_for_status()
        return r.json()["access_token"]

async def create_subscription(plan_id: str, return_url: str, cancel_url: str):
    token = await get_token()
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{API_BASE}/v2/billing/subscriptions",
            json={"plan_id": plan_id,
                  "application_context": {"return_url": return_url, "cancel_url": cancel_url}},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        approval_url = next(link["href"] for link in data["links"] if link["rel"] == "approve")
        return data["id"], approval_url

async def get_subscription(subscription_id: str):
    token = await get_token()
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{API_BASE}/v2/billing/subscriptions/{subscription_id}",
            headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()

async def cancel_subscription(subscription_id: str):
    token = await get_token()
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{API_BASE}/v2/billing/subscriptions/{subscription_id}/cancel",
            json={"reason": "User requested cancellation"},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        r.raise_for_status()
