# everett-interpretation

An interactive visual proof of concept for the Everett interpretation, better known as
the many-worlds interpretation.

## Branch Field

This repository now contains a browser-based TypeScript simulation. It renders a
wave-packet-like field where each measurement event branches the current histories
instead of collapsing them. Branch brightness follows the Born-style squared
amplitude weight, while decoherence causes sibling histories to drift apart and
lose interference memory.

The simulation is intentionally abstract rather than a full quantum mechanics
solver. It is meant to make the Everett idea feel observable:

- each glowing trace is one possible history;
- measurement creates child branches with different weights;
- the observer basis changes how branches split;
- decoherence separates histories until interference fades;
- "Show single branch" lets you view a collapse-like subjective path.

## Run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```
