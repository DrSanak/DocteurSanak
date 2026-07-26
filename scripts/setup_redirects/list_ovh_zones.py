#!/usr/bin/env python3
"""List every DNS zone the OVH token can access."""
import os, sys, ovh
from dotenv import load_dotenv
load_dotenv()

c = ovh.Client(
    endpoint=os.getenv("OVH_ENDPOINT", "ovh-eu"),
    application_key=os.getenv("OVH_APP_KEY"),
    application_secret=os.getenv("OVH_APP_SECRET"),
    consumer_key=os.getenv("OVH_CONSUMER_KEY"),
)

zones = sorted(c.get("/domain/zone"))
print(f"\n{len(zones)} DNS zones visible to this token:\n")
for z in zones:
    print(f"  {z}")
print()

# Check for the two missing ones
for needle in ("operationlasikbrussels.be", "operationlasikbrussels.com"):
    found = needle in zones
    status = "✓ found" if found else "✗ NOT in zone list"
    print(f"  {needle}: {status}")
print()
