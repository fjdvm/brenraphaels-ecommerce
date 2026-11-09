# Ticket 243: `main` protection

Spec #229 (Authentication tracker). The `main-protection` ruleset is **active** on the default branch.

| Rule | Value |
| --- | --- |
| Require a pull request | on, 0 approvals |
| Required status check | `ci-gate` (GitHub Actions) |
| Require branches to be up to date | off (`main` rebuilds from merged code) |
| Force pushes and deletion | blocked |
| Bypass | Repository admin, pull requests only |
| Auto-merge | enabled, squash |

Verify:

```sh
gh api repos/fjdvm/brenraphaels-ecommerce --jq .allow_auto_merge
gh api repos/fjdvm/brenraphaels-ecommerce/rules/branches/main --jq '.[].type'
# deletion, non_fast_forward, pull_request, required_status_checks
```

Rollback: untick auto-merge and delete the ruleset (Settings, Rules, Rulesets).
