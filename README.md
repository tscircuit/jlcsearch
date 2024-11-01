# jlcpcb-parts-engine

This is an engine (API + Admin Backend) for searching JLCPCB parts, the main
goal is to automatically select components to be placed when a tscircuit user
doesn't specify what part they'd like. For example:

```tsx
<resistor resistance="1k" footprint="0605" />
```

This resistor doesn't give a part number, so we should automatically determine
the part number for the user based on what stock is available.
