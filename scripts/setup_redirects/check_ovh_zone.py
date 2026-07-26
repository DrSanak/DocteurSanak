#!/usr/bin/env python3
"""Show the current state of a domain's zone on OVH (records + redirections)."""
import os
import sys
import ovh
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) != 2:
    sys.stderr.write("Usage: python3 check_ovh_zone.py DOMAIN\n")
    sys.exit(1)

domain = sys.argv[1]

client = ovh.Client(
    endpoint=os.getenv("OVH_ENDPOINT", "ovh-eu"),
    application_key=os.getenv("OVH_APP_KEY"),
    application_secret=os.getenv("OVH_APP_SECRET"),
    consumer_key=os.getenv("OVH_CONSUMER_KEY"),
)

print(f"\n=== Zone: {domain} ===\n")

# Redirections
print("OVH web redirections:")
try:
    rids = client.get(f"/domain/zone/{domain}/redirection")
    if not rids:
        print("  (none)")
    for rid in rids:
        r = client.get(f"/domain/zone/{domain}/redirection/{rid}")
        sub = r.get("subDomain") or "@"
        print(f"  [{rid}] {sub} → {r.get('target')} (type={r.get('type')})")
except Exception as e:
    print(f"  Error: {e}")

# All records
print("\nDNS records:")
all_records = []
for ftype in ("A", "AAAA", "CNAME", "TXT", "MX", "NS"):
    rids = client.get(f"/domain/zone/{domain}/record", fieldType=ftype)
    for rid in rids:
        r = client.get(f"/domain/zone/{domain}/record/{rid}")
        all_records.append((ftype, r))

for ftype, r in sorted(all_records, key=lambda x: (x[0], x[1].get("subDomain") or "")):
    sub = r.get("subDomain") or "@"
    target = r.get("target")
    ttl = r.get("ttl", "?")
    print(f"  {ftype:6s} {sub:20s} → {target}   (ttl={ttl})")

print()
