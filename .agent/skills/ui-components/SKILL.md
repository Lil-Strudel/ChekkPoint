---
name: ui-components
description: Use whenever building or changing UI in this repo (routes, pages, forms, dialogs, tables, buttons, any JSX markup). Decides whether a piece of UI should be a reusable component, copies it from solid-ui.com (the SolidJS port of shadcn/ui) when one exists and restyles it to this repo, and otherwise builds one the shadcn/solid-ui way on a Kobalte primitive.
---

# UI components

Stack: SolidJS, Tailwind CSS v4, Kobalte, Biome. `src/components/ui/button.tsx` is a finished example of a copied component; compare against it.

## 1. Component or inline?

Make a component for interactive primitives (dialog, menu, select, tabs, tooltip, toast…) and for visual patterns with variants or more than one use (button, badge, card, input). Keep one-off page layout inline.

- Generic primitives go in `src/components/ui/<kebab-name>.tsx`; domain components that compose them go in `src/components/<PascalName>.tsx`.
- Extend an existing `ui/` component with a variant before adding a new one. Don't add a second component for the same job (no `sonner` next to `toast`).

## 2. Look on solid-ui.com first

```sh
curl -s https://www.solid-ui.com/registry/index.json   # every component name
curl -s https://www.solid-ui.com/r/<name>.json          # source, dependencies, registryDependencies
```

Match by concept, not just name (input → `text-field`, autocomplete → `combobox`). A missing entry returns HTTP 200 with HTML, so check you got JSON.

## 3. Copy it

Don't run `solidui-cli`; it writes a Tailwind v3 setup. By hand:

1. Write `files[].content` into `src/components/ui/`. Repeat for each `registryDependencies` entry not already there; `pnpm add` missing `dependencies`.
2. Rewrite `~/registry/ui/` imports to `~/components/ui/`.
3. Convert the v3 class names to v4 in one pass, so `shadow` doesn't become `shadow-sm` and then `shadow-xs`:

   | v3 | v4 |
   | --- | --- |
   | `shadow-sm` / `shadow` | `shadow-xs` / `shadow-sm` |
   | `rounded-sm` / `rounded` (and `-t`, `-l`…) | `rounded-xs` / `rounded-sm` |
   | `outline-none` | `outline-hidden` |
   | bare `ring` | `ring-3` |

   Centered content (`-translate-*-1/2`) with `slide-in-*`/`slide-out-*` flies in from a corner in v4; drop the `slide-*` classes and keep fade/zoom.
4. Restyle per step 5, then `pnpm biome check --write src/components/ui`.

Say which dependency components you pulled in.

## 4. No match: build it the shadcn way

Before writing any behavior (open state, focus, keyboard, ARIA, positioning), find the Kobalte primitive for it: `curl -s https://kobalte.dev/llms.txt`. Hand-write behavior only when Kobalte has nothing, and say so.

Mirror `button.tsx` and the closest solid-ui source:

- Wrap the Kobalte primitive with `PolymorphicProps`, as solid-ui does.
- Variants in an exported `cva` `<name>Variants` const; merge with `cn(nameVariants(...), local.class)`.
- `splitProps`, never destructure props (it breaks reactivity).
- Compound parts as named exports (`Card`, `CardHeader`, `CardContent`).
- Style state off data attributes (`data-[expanded]:`), not computed class strings.

## 5. Style it

The look comes from `docs/style-guide.md`. Use only the semantic token utilities in `src/styles.css` (`bg-primary`, `text-muted-foreground`, `rounded-md`…), never color literals or arbitrary values that bypass them. Brand values belong in the tokens, not in components: if the guide needs something no token expresses, add a token. Restyle a copied component's classes; keep its structure, props and variant names.

If the style guide doesn't exist yet, leave copied components as they are, use the tokens for new markup, invent no brand values, and say the styling is waiting on the guide.

## 6. Use and verify

Replace the ad-hoc markup at the call site; mention other pages that could use it rather than migrating them. Then `pnpm biome check` and `pnpm typecheck` must pass, and look at it rendered in every variant and state. Report anything you couldn't check.
