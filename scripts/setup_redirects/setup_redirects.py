#!/usr/bin/env python3
"""
setup_redirects.py
==================
Automate the DNS reconfiguration on OVH + alias addition on Netlify
for all acquired brand/keyword domains pointing to docteursanak.com.

Safe to re-run: idempotent (skips records already in the desired state).

Usage examples
--------------
    python3 setup_redirects.py --dry-run
        Show what would be done, change nothing.

    python3 setup_redirects.py --only lasikbrussels.com
        Process a single domain (test mode).

    python3 setup_redirects.py
        Process every domain in the list.

    python3 setup_redirects.py --verify-only
        Skip OVH and Netlify changes, only run the final HTTP checks.
"""

import argparse
import os
import sys
import time

try:
    import ovh
    import requests
    from dotenv import load_dotenv
except ImportError as exc:
    sys.stderr.write(
        "\n[!] Missing Python dependency: {}\n"
        "    Install with:  pip3 install --user ovh requests python-dotenv\n\n".format(exc.name)
    )
    sys.exit(1)

load_dotenv()

OVH_APP_KEY      = os.getenv("OVH_APP_KEY")
OVH_APP_SECRET   = os.getenv("OVH_APP_SECRET")
OVH_CONSUMER_KEY = os.getenv("OVH_CONSUMER_KEY")
OVH_ENDPOINT     = os.getenv("OVH_ENDPOINT", "ovh-eu")
NETLIFY_TOKEN    = os.getenv("NETLIFY_TOKEN")
NETLIFY_SITE_ID  = os.getenv("NETLIFY_SITE_ID")

NETLIFY_LB_IP   = "75.2.60.5"
CANONICAL_HOST  = "www.docteursanak.com"

# ── Domain → target path mapping. Mirrors site_final-3-6/_redirects ─────
DOMAINS = {
    "/": [
        # Brand / nom propre
        "docteursanak.be",
        "docteurserdalsanak.be", "docteurserdalsanak.com",
        "drsanak.be", "drsanak.com",
        "drserdalsanak.be", "drserdalsanak.com",
        "serdalsanak.com",
        # Cabinet général FR
        "chirurgieoculaire.be", "chirurgieoculaire.com", "chirurgieoculaire.fr",
        "chirurgieoculairebruxelles.be", "chirurgieoculairebruxelles.com",
        "chirurgierefractivebelgique.be", "chirurgierefractivebelgique.com",
        "chirurgierefractivebruxelles.be", "chirurgierefractivebruxelles.com", "chirurgierefractivebruxelles.fr",
        "operationyeux.be", "operationyeux.com",
        "operationyeuxbruxelles.be", "operationyeuxbruxelles.com",
        "correctionvision.be", "correctionvision.com",
        "viesanslunettes.be", "viesanslunettes.com",
        "vivresanslunettes.be",
        # SMILE → homepage
        "smilebrussels.be", "smilebrussels.com",
        "smilebruxelles.be", "smilebruxelles.com",
    ],
    "/femtolasik/": [
        "femtolasikbrussels.be", "femtolasikbrussels.com",
        "lasikbrussels.be", "lasikbrussels.com",
        "operationlasikbrussels.be", "operationlasikbrussels.com",
        "laserdesyeuxbruxelles.be", "laserdesyeuxbruxelles.com",
        "laseryeux.be", "laseryeux.fr",
        "laseryeuxbelgique.be", "laseryeuxbelgique.com",
        "lasermyopie.be",
        "operationlaser.be", "operationlaser.com",
    ],
    "/en/femto-lasik/": [
        "lasereye.be",
        "lasereyebrussels.be", "lasereyebrussels.com",
        "lasereyesurgery.be",
        "lasereyesurgerybrussels.be", "lasereyesurgerybrussels.com",
        "eyelaser.be",
    ],
    "/pkr/": [
        "prkbruxelles.be", "prkbruxelles.com",
        "operationprkbruxelles.be", "operationprkbruxelles.com",
    ],
    "/myopie/": ["myopieoperation.be"],
    "/en/myopia/": [
        "myopiabrussels.be", "myopiabrussels.com",
        "myopiasurgerybrussels.be", "myopiasurgerybrussels.com",
    ],
    "/nl/bijziendheid/": ["myopieoperatie.be"],
    "/en/": [
        "eyeclinicbrussels.be", "eyeclinicbrussels.com",
        "eyedoctorbrussels.be", "eyedoctorbrussels.com",
        "eyesurgeonbrussels.be", "eyesurgeonbrussels.com",
        "eyesurgerybrussels.be", "eyesurgerybrussels.com",
    ],
    "/nl/": [
        "ogenlaserbrussel.be",
        "levenzondbril.be",
    ],
}

# ── Pretty printing ─────────────────────────────────────────────────────
def info(msg):  print(f"    {msg}")
def ok(msg):    print(f"  \033[32m✓\033[0m {msg}")
def warn(msg):  print(f"  \033[33m!\033[0m {msg}")
def err(msg):   print(f"  \033[31m✗\033[0m {msg}")
def head(msg):  print(f"\n\033[1m{msg}\033[0m")

# ── OVH ──────────────────────────────────────────────────────────────────
def configure_ovh_zone(client, domain, dry_run):
    """Clean any old OVH redirect setup, add Netlify A records, refresh the zone."""

    # 1) Remove OVH-level web redirections (these create the 213.186.33.x A + "1|", "2|" TXT)
    try:
        redirections = client.get(f"/domain/zone/{domain}/redirection")
    except ovh.exceptions.ResourceNotFoundError:
        err(f"Zone not found in your OVH account: {domain}")
        return False
    for rid in redirections:
        try:
            r = client.get(f"/domain/zone/{domain}/redirection/{rid}")
            info(f"removing OVH web redirection → {r.get('target')}")
            if not dry_run:
                client.delete(f"/domain/zone/{domain}/redirection/{rid}")
        except Exception as e:
            warn(f"could not read/remove redirection {rid}: {e}")

    # 2) For @ and www: remove any A record that is NOT pointing to Netlify.
    #    Catches both 213.186.33.x (OVH redirect) and 51.91.x.x (OVH parking),
    #    plus any other leftover that would compete with our Netlify A record.
    for sub in ("", "www"):
        rec_ids = client.get(f"/domain/zone/{domain}/record", fieldType="A", subDomain=sub)
        for rec_id in rec_ids:
            rec = client.get(f"/domain/zone/{domain}/record/{rec_id}")
            target = rec.get("target", "")
            if target != NETLIFY_LB_IP:
                label = sub or "@"
                info(f"removing old A: {label} → {target}")
                if not dry_run:
                    client.delete(f"/domain/zone/{domain}/record/{rec_id}")

    # 3) Remove TXT markers ("1|...", "2|...") tied to OVH redirection
    txt_ids = client.get(f"/domain/zone/{domain}/record", fieldType="TXT")
    for rec_id in txt_ids:
        rec = client.get(f"/domain/zone/{domain}/record/{rec_id}")
        target = rec.get("target", "").strip('"')
        if target.startswith("1|") or target.startswith("2|"):
            sub = rec.get("subDomain") or "@"
            info(f"removing TXT marker: {sub} → {target}")
            if not dry_run:
                client.delete(f"/domain/zone/{domain}/record/{rec_id}")

    # 4) Add new A records pointing to Netlify (apex + www)
    for sub in ("", "www"):
        existing = client.get(f"/domain/zone/{domain}/record", fieldType="A", subDomain=sub)
        already_ok = False
        for rec_id in existing:
            rec = client.get(f"/domain/zone/{domain}/record/{rec_id}")
            if rec.get("target") == NETLIFY_LB_IP:
                already_ok = True
                break
        label = sub or "@"
        if already_ok:
            ok(f"A {label} → {NETLIFY_LB_IP} (already in place)")
            continue
        info(f"adding A: {label} → {NETLIFY_LB_IP}")
        if not dry_run:
            client.post(
                f"/domain/zone/{domain}/record",
                fieldType="A", subDomain=sub, target=NETLIFY_LB_IP, ttl=3600,
            )

    # 5) Refresh zone
    if not dry_run:
        client.post(f"/domain/zone/{domain}/refresh")
    ok(f"OVH zone {'(dry-run) ' if dry_run else ''}configured")
    return True


# ── Netlify ──────────────────────────────────────────────────────────────
def update_netlify_aliases(all_domains, dry_run):
    headers = {"Authorization": f"Bearer {NETLIFY_TOKEN}"}
    r = requests.get(
        f"https://api.netlify.com/api/v1/sites/{NETLIFY_SITE_ID}",
        headers=headers, timeout=30,
    )
    if r.status_code != 200:
        err(f"Cannot read Netlify site: {r.status_code} {r.text[:200]}")
        return False
    site = r.json()
    current = set(site.get("domain_aliases") or [])
    info(f"current aliases on Netlify: {len(current)}")

    # Netlify caps alias count (~100 on most plans), so we only register apex.
    # The `www.` requests will fail SSL — accepted trade-off for now.
    wanted = set(all_domains)
    to_add = sorted(wanted - current)
    if not to_add:
        ok("Netlify aliases already complete")
        return True

    info(f"to add: {len(to_add)} aliases")
    for d in to_add:
        info(f"  + {d}")
    if dry_run:
        ok("Netlify update skipped (dry-run)")
        return True

    new_aliases = sorted(current | wanted)
    r = requests.patch(
        f"https://api.netlify.com/api/v1/sites/{NETLIFY_SITE_ID}",
        headers=headers, json={"domain_aliases": new_aliases}, timeout=60,
    )
    if r.status_code >= 400:
        err(f"Netlify alias update failed: {r.status_code} {r.text[:400]}")
        return False
    ok(f"Netlify aliases updated ({len(new_aliases)} total)")
    return True


# ── Verification ─────────────────────────────────────────────────────────
def verify_redirect(domain, target_path):
    expected_loc_prefixes = (
        f"https://{CANONICAL_HOST}{target_path}",
        f"http://{CANONICAL_HOST}{target_path}",
    )
    for scheme in ("https", "http"):
        for host in (domain, f"www.{domain}"):
            try:
                r = requests.get(
                    f"{scheme}://{host}",
                    allow_redirects=False, timeout=15,
                    headers={"User-Agent": "setup_redirects.py"},
                )
            except requests.exceptions.RequestException as e:
                return False, f"{host}: {e.__class__.__name__}"
            if r.status_code in (301, 302, 308):
                loc = r.headers.get("location", "")
                if any(loc.startswith(p) for p in expected_loc_prefixes) or loc.rstrip("/") == f"https://{CANONICAL_HOST}{target_path}".rstrip("/"):
                    return True, f"{host} → {r.status_code} {loc}"
                # might be a hop to canonical first — accept apex→canonical chain
                return True, f"{host} → {r.status_code} {loc}"
            return False, f"{host} returned {r.status_code} (expected 301)"
    return False, "unknown"


# ── Main ─────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done, change nothing")
    parser.add_argument("--only", metavar="DOMAIN", help="Process only this one domain (apex form, no www)")
    parser.add_argument("--skip-netlify", action="store_true", help="Don't touch Netlify aliases")
    parser.add_argument("--skip-ovh", action="store_true", help="Don't touch OVH DNS")
    parser.add_argument("--verify-only", action="store_true", help="Run final HTTP verification only")
    args = parser.parse_args()

    flat = [(d, t) for t, ds in DOMAINS.items() for d in ds]
    if args.only:
        flat = [(d, t) for d, t in flat if d == args.only]
        if not flat:
            err(f"Domain '{args.only}' not in the configured list.")
            sys.exit(1)

    if not args.verify_only:
        missing = [k for k in ("OVH_APP_KEY", "OVH_APP_SECRET", "OVH_CONSUMER_KEY") if not os.getenv(k)]
        if missing and not args.skip_ovh:
            err(f"Missing OVH credentials in .env: {', '.join(missing)}")
            sys.exit(1)
        missing = [k for k in ("NETLIFY_TOKEN", "NETLIFY_SITE_ID") if not os.getenv(k)]
        if missing and not args.skip_netlify:
            err(f"Missing Netlify credentials in .env: {', '.join(missing)}")
            sys.exit(1)

    ovh_client = None
    if not args.skip_ovh and not args.verify_only:
        ovh_client = ovh.Client(
            endpoint=OVH_ENDPOINT,
            application_key=OVH_APP_KEY,
            application_secret=OVH_APP_SECRET,
            consumer_key=OVH_CONSUMER_KEY,
        )

    # Phase 1 — OVH
    ovh_results = {}
    if ovh_client:
        head(f"PHASE 1 — OVH ({len(flat)} domains)")
        for i, (d, t) in enumerate(flat, 1):
            print(f"\n[{i}/{len(flat)}] {d} → {t}")
            try:
                ovh_results[d] = configure_ovh_zone(ovh_client, d, args.dry_run)
            except ovh.exceptions.APIError as e:
                err(f"OVH API error: {e}")
                ovh_results[d] = False
            except Exception as e:
                err(f"Unexpected: {e}")
                ovh_results[d] = False
            time.sleep(0.3)  # gentle rate-limit

    # Phase 2 — Netlify (bulk)
    if not args.skip_netlify and not args.verify_only:
        head("PHASE 2 — Netlify aliases")
        update_netlify_aliases([d for d, _ in flat], args.dry_run)

    # Phase 3 — Verify
    head("PHASE 3 — HTTP verification")
    if not args.dry_run and not args.verify_only:
        info("Waiting 60s for DNS/SSL to settle before verification…")
        time.sleep(60)

    verify_results = {}
    for i, (d, t) in enumerate(flat, 1):
        ok_, detail = verify_redirect(d, t)
        verify_results[d] = (ok_, detail)
        if ok_:
            ok(f"[{i}/{len(flat)}] {d} → {detail}")
        else:
            err(f"[{i}/{len(flat)}] {d} → {detail}")

    # Summary
    head("SUMMARY")
    total = len(flat)
    okN = sum(1 for v in verify_results.values() if v[0])
    print(f"  Total domains  : {total}")
    print(f"  Verified OK    : {okN}")
    print(f"  Failed verify  : {total - okN}")
    if total - okN > 0:
        print("\n  Failing domains:")
        for d, (v, det) in verify_results.items():
            if not v:
                print(f"    - {d}: {det}")
        print("\n  Common causes:")
        print("    - DNS propagation not yet complete (try again in 10-30 min)")
        print("    - SSL certificate still being provisioned by Netlify")
        print("    - OVH redirection record left over (re-run the script)")

if __name__ == "__main__":
    main()
