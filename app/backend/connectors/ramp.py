"""Ramp expense connector — OAuth 2.0 Client Credentials, sync transactions to SQLite."""

import logging
import os
import time
from datetime import datetime, timedelta

import httpx

from config import RAMP_TRANSACTION_SYNC_DAYS
from database import get_db

logger = logging.getLogger(__name__)

RAMP_BASE_URL = "https://api.ramp.com"
TOKEN_URL = f"{RAMP_BASE_URL}/developer/v1/token"
TRANSACTIONS_URL = f"{RAMP_BASE_URL}/developer/v1/transactions"

# In-memory token cache
_cached_token: str | None = None
_token_expires_at: float = 0


def _get_ramp_credentials() -> tuple[str, str]:
    client_id = os.environ.get("RAMP_CLIENT_ID", "")
    client_secret = os.environ.get("RAMP_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("RAMP_CLIENT_ID and RAMP_CLIENT_SECRET must be set in .env")
    return client_id, client_secret


def _get_access_token() -> str:
    """Get a valid access token, refreshing if needed."""
    global _cached_token, _token_expires_at

    if _cached_token and time.time() < _token_expires_at:
        return _cached_token

    client_id, client_secret = _get_ramp_credentials()
    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _cached_token = data["access_token"]
    # Ramp tokens last 10 days; refresh after 9
    _token_expires_at = time.time() + 9 * 86400
    return _cached_token


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_access_token()}",
        "Accept": "application/json",
    }


def sync_ramp_transactions() -> int:
    """Fetch recent transactions from Ramp and store in SQLite. Returns count."""
    cutoff = datetime.utcnow() - timedelta(days=RAMP_TRANSACTION_SYNC_DAYS)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT00:00:00Z")

    all_transactions = []
    params: dict = {
        "from_date": cutoff_iso,
        "page_size": 100,
        "order_by_date_desc": "true",
    }

    # Paginate through all results
    while True:
        resp = httpx.get(TRANSACTIONS_URL, headers=_headers(), params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        transactions = data.get("data", data.get("results", []))
        if isinstance(transactions, list):
            all_transactions.extend(transactions)
        else:
            break

        # Cursor-based pagination
        page = data.get("page", {})
        next_cursor = page.get("next")
        if not next_cursor:
            break
        params["start"] = next_cursor

    # Store to DB
    db = get_db()
    db.execute("DELETE FROM ramp_transactions")
    count = 0
    for txn in all_transactions:
        txn_id = txn.get("id", "")
        if not txn_id:
            continue

        # Extract amount — Ramp may nest it
        amount = txn.get("amount", 0)
        if isinstance(amount, dict):
            amount = amount.get("amount", 0)
        amount = abs(float(amount)) if amount else 0

        currency = txn.get("currency_code", txn.get("currency", "USD"))
        if isinstance(txn.get("amount"), dict):
            currency = txn["amount"].get("currency_code", currency)

        merchant = (
            txn.get("merchant_name") or txn.get("merchant_descriptor") or txn.get("merchant", {}).get("name", "Unknown")
        )

        category = txn.get("sk_category_name", txn.get("category", ""))
        category_code = txn.get("sk_category_id", txn.get("category_code"))

        txn_date = txn.get("user_transaction_time") or txn.get("transaction_date") or txn.get("created_at", "")

        # Cardholder info
        cardholder = txn.get("card_holder", {})
        if isinstance(cardholder, dict):
            ch_name = f"{cardholder.get('first_name', '')} {cardholder.get('last_name', '')}".strip() or cardholder.get(
                "name", ""
            )
            ch_email = cardholder.get("email", "")
        else:
            ch_name = ""
            ch_email = ""

        memo = txn.get("memo", txn.get("merchant_category_code_description", ""))
        receipts = txn.get("receipts", [])
        receipt_urls = (
            ",".join(r.get("receipt_url", "") for r in receipts if isinstance(r, dict))
            if isinstance(receipts, list)
            else ""
        )
        status = txn.get("state", txn.get("status", ""))

        db.execute(
            """INSERT OR REPLACE INTO ramp_transactions
               (id, amount, currency, merchant_name, category, category_code,
                transaction_date, cardholder_name, cardholder_email, memo,
                receipt_urls, status, ramp_url, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                txn_id,
                amount,
                currency,
                merchant,
                category,
                category_code,
                txn_date,
                ch_name,
                ch_email,
                memo,
                receipt_urls,
                status,
                None,
                datetime.utcnow().isoformat(),
            ),
        )
        count += 1

    db.commit()
    db.close()
    return count


def check_ramp_connection() -> dict:
    """Test Ramp API connectivity. Returns status dict."""
    result = {"configured": False, "connected": False, "error": None, "detail": None}
    try:
        client_id, client_secret = _get_ramp_credentials()
        result["configured"] = True
        token = _get_access_token()
        if token:
            result["connected"] = True
            result["detail"] = "Authenticated via OAuth client credentials"
    except ValueError as e:
        result["detail"] = str(e)
    except Exception as e:
        result["configured"] = True
        result["error"] = str(e)
    return result
