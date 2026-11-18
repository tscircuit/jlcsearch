# `is_extended_promotional` Column

## Overview

The `is_extended_promotional` column is a boolean field (stored as `INTEGER 0/1` in SQLite) on the `components` table.

## What it means

JLCPCB categorises its parts library into several types:

| Library Type | `is_basic` | `is_preferred` | `is_extended_promotional` |
|---|---|---|---|
| `Basic` | ✅ | ❌ | ❌ |
| `Preferred` | ❌ | ✅ | ❌ |
| `Extended Promotional` | ❌ | ❌ | ✅ |
| `Extended` | ❌ | ❌ | ❌ |

**Extended Promotional** parts temporarily act like Basic parts — no additional placement fee — but only for a **limited time window**. After the promotional period ends they revert to standard Extended pricing.

## Source data

The value is parsed from the **`Library Type`** column in the JLCPCB component CSV export. The populate script maps the value `"Extended Promotional"` (case-insensitive) to `is_extended_promotional = 1`.

## Filtering via API

You can filter for extended promotional parts using the `is_extended_promotional` query parameter on the `/components/list` endpoint:

```
GET /components/list?is_extended_promotional=true
```

This makes it easy to find parts that currently have no extra placement fee but might gain one in the future.
