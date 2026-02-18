"""Supabase helpers for API-side auth, database, and storage operations."""

from __future__ import annotations

import os
from typing import Any, Optional
from urllib.parse import quote

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "books")


class SupabaseConfigError(RuntimeError):
    pass


def ensure_supabase_configured() -> None:
    if not SUPABASE_URL:
        raise SupabaseConfigError("Supabase URL is not configured")
    if not SUPABASE_ANON_KEY:
        raise SupabaseConfigError("Supabase anon key is not configured")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseConfigError("Supabase service role key is not configured")


def _auth_headers_with_anon(access_token: str) -> dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {access_token}",
    }


def _service_headers(extra: Optional[dict[str, str]] = None) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    if extra:
        headers.update(extra)
    return headers


async def verify_user_access_token(access_token: str) -> dict[str, Any]:
    """Validate Supabase access token and return user payload."""
    ensure_supabase_configured()
    url = f"{SUPABASE_URL}/auth/v1/user"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, headers=_auth_headers_with_anon(access_token))

    if response.status_code >= 400:
        raise SupabaseConfigError("Unauthorized Supabase session")

    return response.json()


async def fetch_profile(user_id: str) -> Optional[dict[str, Any]]:
    ensure_supabase_configured()
    url = f"{SUPABASE_URL}/rest/v1/profiles"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            url,
            params={
                "id": f"eq.{user_id}",
                "select": "id,email,full_name,plan,credits_remaining,stripe_customer_id",
                "limit": 1,
            },
            headers=_service_headers(),
        )

    if response.status_code >= 400:
        raise SupabaseConfigError(f"Failed to fetch profile: {response.text}")

    rows = response.json()
    return rows[0] if rows else None


async def update_profile(user_id: str, payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    ensure_supabase_configured()
    url = f"{SUPABASE_URL}/rest/v1/profiles"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.patch(
            url,
            params={
                "id": f"eq.{user_id}",
                "select": "id,email,full_name,plan,credits_remaining,stripe_customer_id",
                "limit": 1,
            },
            headers=_service_headers({"Content-Type": "application/json", "Prefer": "return=representation"}),
            json=payload,
        )

    if response.status_code >= 400:
        raise SupabaseConfigError(f"Failed to update profile: {response.text}")

    rows = response.json()
    return rows[0] if rows else None


async def insert_book(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_supabase_configured()
    url = f"{SUPABASE_URL}/rest/v1/books"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            headers=_service_headers({"Content-Type": "application/json", "Prefer": "return=representation"}),
            json=payload,
        )

    if response.status_code >= 400:
        raise SupabaseConfigError(f"Failed to insert book: {response.text}")

    rows = response.json()
    if not rows:
        raise SupabaseConfigError("Failed to insert book: empty response")
    return rows[0]


async def update_book(book_id: str, payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    ensure_supabase_configured()
    url = f"{SUPABASE_URL}/rest/v1/books"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.patch(
            url,
            params={
                "id": f"eq.{book_id}",
                "select": "id,user_id,title,status,pdf_url,epub_url,cover_image_url,created_at",
                "limit": 1,
            },
            headers=_service_headers({"Content-Type": "application/json", "Prefer": "return=representation"}),
            json=payload,
        )

    if response.status_code >= 400:
        raise SupabaseConfigError(f"Failed to update book: {response.text}")

    rows = response.json()
    return rows[0] if rows else None


async def ensure_storage_bucket(bucket: str = SUPABASE_STORAGE_BUCKET) -> None:
    ensure_supabase_configured()
    bucket_url = f"{SUPABASE_URL}/storage/v1/bucket/{bucket}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        exists_response = await client.get(bucket_url, headers=_service_headers())
        if exists_response.status_code == 200:
            return
        if exists_response.status_code not in (404,):
            raise SupabaseConfigError(f"Failed checking storage bucket: {exists_response.text}")

        create_response = await client.post(
            f"{SUPABASE_URL}/storage/v1/bucket",
            headers=_service_headers({"Content-Type": "application/json"}),
            json={"id": bucket, "name": bucket, "public": True},
        )

    if create_response.status_code not in (200, 201, 409):
        raise SupabaseConfigError(f"Failed creating storage bucket: {create_response.text}")


async def upload_file(
    *,
    user_id: str,
    book_id: str,
    filename: str,
    content: bytes,
    content_type: str,
    bucket: str = SUPABASE_STORAGE_BUCKET,
) -> str:
    """Upload file to Supabase storage and return public URL."""
    ensure_supabase_configured()
    await ensure_storage_bucket(bucket)

    object_path = f"{user_id}/{book_id}/{filename}"
    encoded_path = quote(object_path, safe="/")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{encoded_path}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            upload_url,
            headers=_service_headers({
                "Content-Type": content_type,
                "x-upsert": "true",
            }),
            content=content,
        )

    if response.status_code >= 400:
        raise SupabaseConfigError(f"Failed to upload file to storage: {response.text}")

    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{encoded_path}"
