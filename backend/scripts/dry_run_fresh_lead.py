"""Genera un nuovo tenant Martinel Interior Design (Mario Rossi) e
stampa il magic_link_url + le credenziali risultanti.
Used dal go-live dry run per esercitare l'esperienza Founder nel browser.
"""
from __future__ import annotations
import asyncio, os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
API  = f"{BASE}/api"
ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'


async def main() -> None:
    ts = int(time.time())
    visitor_email = f"mario.rossi.dryrun.{ts}@martinel.example"
    studio_name   = "Martinel Interior Design"

    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        d = await cli.post('/studio/activation/draft', json={})
        token = d.json()['draft_token']

        await cli.patch('/studio/activation/draft', json={
            'draft_token': token,
            'archetype': 'interior_studio',
            'experiences': ['design_journey_os', 'moodboard_experience',
                            'client_presentation_flow'],
            'movement': 'identity',
            'payload': {'studio_name': studio_name, 'monogram': 'MD'},
        })

        r = await cli.post('/studio/v2/submit', json={
            'draft_token':     token,
            'archetype_code':  'interior_design',
            'primary_operating_market_code': 'italy',
            'headquarter_country_iso':       'IT',
            'headquarter_city':              'Pordenone',
            'headquarter_region':            'Friuli-Venezia Giulia',
            'headquarter_lat':               45.9626,
            'headquarter_lng':               12.6536,
            'mapbox_place_id':               'place.simulation.pordenone',
            'target_country_isos':           ['US', 'GB', 'AE'],
            'studio_name':   studio_name,
            'first_name':    'Mario',
            'last_name':     'Rossi',
            'contact_email': visitor_email,
            'phone_prefix':  '+39',
            'phone_number':  '345 1234567',
            'help_topics':   ['design_journey_os'],
            'locale':        'it-IT',
        })
        sub = r.json()
        request_id = sub.get('request_id')
        reference  = sub.get('reference')

        # Admin login
        r = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        jwt = r.json()['token']
        h = {'Authorization': f'Bearer {jwt}'}

        # Transitions
        for st in ('reviewing', 'contacted', 'qualified'):
            await cli.patch(f'/admin/studio/requests/{request_id}',
                            json={'status': st}, headers=h)

        # Activation preview (for screenshot evidence of modal-equivalent payload)
        prev = (await cli.get(
            f'/admin/studio/requests/{request_id}/activation-preview',
            headers=h)).json()

        # Activate
        ar = await cli.post(f'/admin/studio/requests/{request_id}/activate',
                            json={
                                'tenant_slug': 'martinel-interior-design',
                                'tenant_name': studio_name,
                            }, headers=h)
        act = ar.json()

    print(json.dumps({
        'reference':         reference,
        'request_id':        request_id,
        'visitor_email':     visitor_email,
        'preview':           prev,
        'tenant_slug':       act.get('slug'),
        'tenant_id':         act.get('tenant_id'),
        'magic_link_url':    act.get('magic_link_url'),
        'founder_user_id':   act.get('founder_user_id'),
        'activation_status': act.get('ok'),
    }, indent=2, default=str))


if __name__ == '__main__':
    asyncio.run(main())
