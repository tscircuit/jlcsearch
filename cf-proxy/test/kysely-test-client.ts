// Resolve the same Kysely installation as the worker queries. CI installs the
// root and cf-proxy dependencies separately; their private class types differ.
export { Kysely } from "kysely"
