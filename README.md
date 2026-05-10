# cromatica — CLI

> Official CLI toolkit for [Cromatica Media](https://cromatica.media) projects.

Fetch and scaffold blocks, templates and components directly from the
[Cromatica Block Bank](https://bank.cromatica.media) into your project
with a single command.

---

## Requirements

- Node.js 18+
- A project based on `cm-template-website`
- pnpm (recommended) or npm

---

## Usage

No installation needed. Run directly with `npx`:

```bash
npx cromatica <command> <subcommand> [arguments]
```

---

## Commands

### `add block`

Fetches a block from the Cromatica Block Bank and scaffolds it into your
`cm-template-website` project.

```bash
npx cromatica add block [block-name]
```

**Example:**

```bash
npx cromatica add block hero-cards
```

**What it does:**

1. Fetches `hero-cards` from the Block Bank API
2. Creates the React component:

```
src/components/blocks/hero-cards/
├── HeroCards.tsx
└── index.ts
```

3. Creates the Payload CMS schema:

```
src/blocks/hero-cards/
├── HeroCards.block.ts
└── index.ts
```

4. Injects the block into `src/fields/Blocks/Blocks.field.ts`:

```ts
import HeroCardsBlock from "@/blocks/hero-cards";
// and adds HeroCardsBlock to the blocks array
```

5. Installs any required npm dependencies declared in the block

---

## Block naming convention

Blocks use `kebab-case` slugs in the Bank and are automatically converted
to `PascalCase` when scaffolded:

| Bank slug    | Component name  | Import name      |
| ------------ | --------------- | ---------------- |
| `hero-cards` | `HeroCards.tsx` | `HeroCardsBlock` |
| `perks-grid` | `PerksGrid.tsx` | `PerksGridBlock` |
| `cta-split`  | `CtaSplit.tsx`  | `CtaSplitBlock`  |

---

## Project structure expected

The CLI assumes your project follows the `cm-template-website` structure:

```
src/
├── components/
│   └── blocks/               ← React components land here
├── blocks/                   ← Payload schemas land here
└── fields/
    └── Blocks/
        └── Blocks.field.ts   ← auto-updated by the CLI
```

---

## How it works

The CLI fetches block data from the public Cromatica Block Bank API:

```
GET https://bank.cromatica.media/api/blocks?where[name][equals]=hero-cards&depth=0
```

The API response contains:

- `files.componentTsx` — the React component source
- `files.blockTs` — the Payload CMS block schema source
- `dependencies` — npm packages required by the block

---

## Roadmap

- [x] `add block [name]` — scaffold a block from the Bank
- [ ] `add template [name]` — scaffold a full page template
- [ ] `list blocks` — list all available blocks in the Bank
- [ ] `list templates` — list all available templates
- [ ] `update block [name]` — update a block to its latest version

---

## Contributing

This CLI is maintained by [Cromatica Media](https://cromatica.media).
Internal use and open contributions welcome.

---

## License

[MIT](./LICENSE) © Cromatica Media
