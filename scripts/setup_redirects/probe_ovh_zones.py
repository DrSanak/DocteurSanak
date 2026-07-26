#!/usr/bin/env python3
"""Probe specific OVH zones to see exactly why they're unreachable."""
import os, ovh
from dotenv import load_dotenv
load_dotenv()

c = ovh.Client(
    endpoint=os.getenv("OVH_ENDPOINT", "ovh-eu"),
    application_key=os.getenv("OVH_APP_KEY"),
    application_secret=os.getenv("OVH_APP_SECRET"),
    consumer_key=os.getenv("OVH_CONSUMER_KEY"),
)

for zone in ("operationlasikbrussels.be", "operationlasikbrussels.com", "chirurgieoculaire.be"):
    print(f"\n— {zone} —")
    for path in (f"/domain/zone/{zone}", f"/domain/{zone}"):
        try:
            r = c.get(path)
            print(f"  GET {path}  →  OK  keys={list(r.keys()) if isinstance(r, dict) else r}")
        except ovh.exceptions.APIError as e:
            print(f"  GET {path}  →  ERROR  {e.__class__.__name__}: {e}")
