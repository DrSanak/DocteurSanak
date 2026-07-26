#!/usr/bin/env python3
"""List your Netlify sites and their IDs, using the token from .env."""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("NETLIFY_TOKEN")
if not token:
    sys.stderr.write("NETLIFY_TOKEN missing from .env\n")
    sys.exit(1)

r = requests.get(
    "https://api.netlify.com/api/v1/sites",
    headers={"Authorization": f"Bearer {token}"},
    timeout=30,
)
if r.status_code != 200:
    sys.stderr.write(f"Netlify API error: {r.status_code} {r.text[:300]}\n")
    sys.exit(1)

sites = r.json()
if not sites:
    print("No sites found on this Netlify account.")
    sys.exit(0)

print(f"\nFound {len(sites)} site(s):\n")
print(f"  {'NAME':<35s} {'PRIMARY DOMAIN':<35s} SITE ID")
print(f"  {'-'*35} {'-'*35} {'-'*36}")
for s in sites:
    name = s.get("name", "?")
    domain = s.get("custom_domain") or s.get("default_domain", "?")
    sid = s.get("id", "?")
    print(f"  {name:<35s} {domain:<35s} {sid}")
print()
