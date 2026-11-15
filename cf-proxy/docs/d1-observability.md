# D1 diagnostic logs

The normal production Worker deployment enables saved logs for a 10% sample of
requests. It does not change database data, indexes or read replication.

In Cloudflare, open **Workers & Pages → jlcsearch-proxy → Observability → Logs**.
Use the structured `event` field to find:

- `request_completed`: route, response status, cache outcome and elapsed time.
  `STALE-ERROR` means an older cached response protected the caller from a failure.
- `d1_query_error`: a failed database query. Filter `error_kind` to `overloaded`
  to find D1 overloads, then group by `route` and `query_kind`.
- `d1_slow_query`: a successful query taking at least 250 ms, including the
  binding round trip. This is not SQLite's execution time alone.
- `d1_operation_error`: a failed route, background refresh or stock-demand write.
  A query error may also produce an operation error; do not add these event
  counts together as separate failed requests.

Compare the same time window in D1 Query Insights for rows read and database
execution time. Confirm the expected Worker version was deployed before judging
whether a fix reduced load.

Sampling applies to errors too. No matching log entries does **not** prove there
were zero overloads. This PR adds visibility, not an alert or an overload fix.
The sampling rate limits log volume; retention and charges follow the account's
Cloudflare plan.

Custom diagnostic events omit search text, SQL, parameters, raw exception
messages, request headers and client identifiers. Automatic invocation logs are
disabled so they do not separately record full request URLs.

Reference: [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).
