<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## UI Components

For any UI work, follow `.agent/skills/ui-components/SKILL.md` (exposed to Claude Code as the `ui-components` skill). It covers when to make a component, copying from solid-ui.com and converting it to Tailwind v4, using Kobalte primitives instead of hand-written behavior, and styling from `docs/style-guide.md`.
