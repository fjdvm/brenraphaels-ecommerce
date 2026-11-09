#!/usr/bin/env bash
set -euo pipefail
export AZURE_CORE_ONLY_SHOW_ERRORS=true
export CONTAINER_ENVIRONMENT_ID
CONTAINER_ENVIRONMENT_ID=$(az containerapp env show -g "$RESOURCE_GROUP" -n cae-brenraphaels --query id -o tsv)
export REVISION_SUFFIX="gh-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
# Carry forward domain bindings if a later ticket adds them; create --yaml
# replaces configuration rather than merging ingress fields.
export EXISTING_CUSTOM_DOMAINS='[]'
existing_apps=$(az containerapp list -g "$RESOURCE_GROUP" --query '[].name' -o tsv)
if printf '%s\n' "$existing_apps" | grep -Fxq "$CONTAINER_APP"; then
  EXISTING_CUSTOM_DOMAINS=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" \
    --query 'properties.configuration.ingress.customDomains' -o json)
  if [ "$EXISTING_CUSTOM_DOMAINS" = null ] || [ -z "$EXISTING_CUSTOM_DOMAINS" ]; then
    EXISTING_CUSTOM_DOMAINS='[]'
  fi
fi
manifest="$RUNNER_TEMP/ecommerce-deploy.json"
trap 'rm -f "$manifest"' EXIT
python3 scripts/deploy/render-container-app.py "$manifest"
# The manifest is mode 0600. Suppress ARM responses containing configuration.
az containerapp create -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --yaml "$manifest" --output none
revision="$CONTAINER_APP--$REVISION_SUFFIX"
ready=false
for attempt in $(seq 1 60); do
  state=$(az containerapp revision show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --revision "$revision" --query properties.healthState -o tsv)
  if [ "$state" = Healthy ]; then ready=true; break; fi
  sleep 10
done
test "$ready" = true
fqdn=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --query properties.configuration.ingress.fqdn -o tsv)
latest=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --query properties.latestReadyRevisionName -o tsv)
test "$latest" = "$revision"
curl --fail --silent --show-error --retry 6 --retry-all-errors "https://$fqdn/api/health"
{
  echo '### Storefront deployment'
  echo "- Default address: https://$fqdn"
  echo "- Healthy revision: $revision"
  echo "- Image: $STOREFRONT_IMAGE"
  echo '- Replicas: min 1, max 2; 0.5 vCPU / 1 GiB'
  echo '- Previous revisions retained inactive for rollback (up to 10).'
} >> "$GITHUB_STEP_SUMMARY"
