"""Render an Azure CLI manifest to a private file; never print secret values."""
import json
import os
from pathlib import Path
import re
import sys

secrets = json.loads(os.environ['DEPLOY_SECRETS'])
secrets['NEXT_PUBLIC_TURNSTILE_SITE_KEY'] = os.environ.get('NEXT_PUBLIC_TURNSTILE_SITE_KEY') or secrets.get('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
keys = re.findall(r'^([A-Z_]+)=', Path('.env.production.example').read_text(), re.M)
# GitHub reserves the GITHUB_ prefix for its own settings.
for key in keys:
    if key.startswith('GITHUB_'):
        secrets[key] = secrets.get('STOREFRONT_' + key, '')
# Optional integrations stay absent when not configured; never send empty secrets.
required = [
    'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'DATABASE_URL', 'NEON_AUTH_BASE_URL',
    'NEON_AUTH_COOKIE_SECRET', 'CAREERS_DATABASE_URL', 'CAREERS_NEON_AUTH_BASE_URL',
    'CAREERS_NEON_AUTH_COOKIE_SECRET', 'BREVO_SMTP_HOST', 'BREVO_SMTP_PORT',
    'BREVO_SMTP_USER', 'BREVO_SMTP_KEY', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME',
    'UNSUBSCRIBE_SECRET', 'CREOMS_SERVICE_SECRET', 'CRON_SECRET', 'TURNSTILE_SECRET_KEY',
    'API_GATEWAY_URL', 'API_GATEWAY_CALLER_KEY', 'GATEWAY_URL', 'GATEWAY_CALLER_KEY',
    'CUSTOMER_NOTIFICATION_CRON_SECRET', 'PRODUCT_IMAGE_ORIGIN',
    'NODE_ENV', 'NEXT_TELEMETRY_DISABLED', 'HOSTNAME', 'PORT', 'GHCR_PULL_TOKEN',
]
missing = [key for key in required if not secrets.get(key)]
if missing:
    sys.exit('Missing GitHub secrets: ' + ', '.join(missing))

keys = [key for key in keys if secrets.get(key)]
secret_keys = keys + ['GHCR_PULL_TOKEN']

def secret_name(key):
    return key.lower().replace('_', '-')

manifest = {
    'location': 'indonesiacentral',
    'properties': {
        'environmentId': os.environ['CONTAINER_ENVIRONMENT_ID'],
        'configuration': {
            'activeRevisionsMode': 'Single',
            'maxInactiveRevisions': 10,
            'secrets': [{'name': secret_name(k), 'value': secrets[k]} for k in secret_keys],
            'registries': [{'server': 'ghcr.io', 'username': os.environ['GHCR_USERNAME'],
                            'passwordSecretRef': 'ghcr-pull-token'}],
            'ingress': {'external': True, 'targetPort': 3000, 'transport': 'auto',
                        'allowInsecure': False,
                        'customDomains': json.loads(os.environ.get('EXISTING_CUSTOM_DOMAINS', '[]')),
                        'traffic': [{'latestRevision': True, 'weight': 100}]},
        },
        'template': {
            'revisionSuffix': os.environ['REVISION_SUFFIX'],
            'containers': [{
                'name': 'ecommerce', 'image': os.environ['STOREFRONT_IMAGE'],
                'resources': {'cpu': 0.5, 'memory': '1Gi'},
                'env': [{'name': k, 'secretRef': secret_name(k)} for k in keys],
                'probes': [{
                    'type': kind,
                    'httpGet': {'path': '/api/health', 'port': 3000, 'scheme': 'HTTP'},
                    'initialDelaySeconds': delay, 'periodSeconds': 10,
                    'timeoutSeconds': 5, 'failureThreshold': failures,
                } for kind, delay, failures in [('Startup', 5, 30), ('Readiness', 5, 3), ('Liveness', 30, 3)]],
            }],
            'scale': {'minReplicas': 1, 'maxReplicas': 2},
        },
    },
}
path = Path(sys.argv[1])
# O_EXCL prevents overwriting an existing file/symlink containing other data.
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    json.dump(manifest, output)
