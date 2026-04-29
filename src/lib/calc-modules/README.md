# `src/lib/calc-modules/`

Framework for AD-11a calculator modules. **Empty by default** — Phase 1 ships only the orchestrator + types + registry skeleton. Each subsequent PR migrates one calculator into the registry.

## Files

| File | Role |
|---|---|
| `index.js` | Public surface — consumers import from `@/lib/calc-modules` only |
| `registry.js` | The Map of registered modules + lookup helpers |
| `types.js` | JSDoc typedefs for `ModuleDef`, `ModuleCapabilities`, `ModuleServices`, `AttachedModuleEntry` |
| `services.js` | Impure-operation surface: `fetchRatesLive`, `buildServices` |
| `orchestrator.js` | `runCompute({module, input, serviceOverrides})` — single entry point for live + frozen compute |
| `useCompute.js` | React hook wrapping `runCompute` for live standalone views (debounce, cancel, loading, error) |

## To register a new module

1. Create `src/lib/calc-modules/<id>/v1/index.js` exporting a `ModuleDef`.
2. Import it into `registry.js` and add to `REGISTRY` + `CURRENT_VERSIONS`.
3. Versions live forever — never delete `v1/` after `v2/` ships. Sent quotes pin to whatever version was current at send time.

## Spec

Full design + decisions: [`Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md`](../../../Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md). Read before adding a module — especially §3 (contract), §4 (compute archetypes), §5 (frozen-result model), §6 (versioning rules).
