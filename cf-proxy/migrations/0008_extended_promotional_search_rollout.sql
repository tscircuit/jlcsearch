-- component_catalog and search_index are data tables owned by the full-catalog
-- sync path, not D1 migrations. Existing deployments are prepared by
-- cf-proxy/scripts/prepare-extended-promotional-search-rollout.sh before the
-- Worker deploys; fresh databases let full_catalog create the canonical schema.
SELECT 1;
