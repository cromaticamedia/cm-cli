# Cromatica — CLI

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

> ⚠️ This command must be run from the root of a `cm-template-website` project.
> Running it in any other directory will abort with an error.

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

1. Validates that the current directory is a valid `cm-template-website` project
2. Fetches `hero-cards` from the Block Bank API
3. Creates the React component:

```
src/components/blocks/HeroCards/
├── HeroCards.tsx
└── index.ts
```

4. Creates the Payload CMS schema:

```
src/blocks/HeroCards/
├── HeroCards.block.ts
└── index.ts
```

5. Injects the block into `src/fields/Blocks/Blocks.field.ts`:

```ts
import HeroCardsBlock from '@/blocks/HeroCards'
// and adds HeroCardsBlock to the blocks array
```

6. Injects the block into `src/components/blocks/RenderBlocks.tsx`:

```tsx
import HeroCards from '@/components/blocks/HeroCards'
// and adds the case to the switch statement
case 'hero-cards':
  return <HeroCards key={index} {...block} locale={locale} />
```

7. Regenerates Payload types by running `pnpm payload generate:types` automatically

---

## Block naming convention

Blocks use `kebab-case` slugs in the Bank and are automatically converted
to `PascalCase` for folders, filenames and import names:

| Bank slug          | Folder & files    | Import name           |
| ------------------ | ----------------- | --------------------- |
| `hero-cards`       | `HeroCards/`      | `HeroCardsBlock`      |
| `perks-grid`       | `PerksGrid/`      | `PerksGridBlock`      |
| `cta-split`        | `CtaSplit/`       | `CtaSplitBlock`       |
| `perks-cards-grid` | `PerksCardsGrid/` | `PerksCardsGridBlock` |

---

## Project validation

Before doing anything, the CLI verifies that the following paths exist in the current directory:

```
src/fields/Blocks/Blocks.field.ts
src/components/blocks/RenderBlocks.tsx
src/blocks/
```

If any of these are missing, the CLI aborts immediately with a clear error:

```
✖ This command must be run inside a cm-template-website project or in a fork of itself.
  Missing: /your/path/src/fields/Blocks/Blocks.field.ts
```

---

## Project structure expected

The CLI assumes your project follows the `cm-template-website` structure:

```
src/
├── components/
│   └── blocks/
│       ├── RenderBlocks.tsx          ← auto-updated by the CLI
│       └── HeroCards/                ← React components land here
│           ├── HeroCards.tsx
│           └── index.ts
├── blocks/
│   └── HeroCards/                    ← Payload schemas land here
│       ├── HeroCards.block.ts
│       └── index.ts
└── fields/
    └── Blocks/
        └── Blocks.field.ts           ← auto-updated by the CLI
```

---

## How it works

The CLI fetches block data from the public Cromatica Block Bank API:

```
GET https://bank.cromatica.media/api/blocks?where[name][equals]=hero-cards&depth=0&limit=1
```

The API response contains:

- `files.componentTsx` — the React component source
- `files.blockTs` — the Payload CMS block schema source

---

## Roadmap

- [x] `add block [name]` — scaffold a block from the Bank
- [x] Project structure validation before scaffolding
- [x] Auto-inject into `Blocks.field.ts`
- [x] Auto-inject into `RenderBlocks.tsx`
- [x] Auto-regenerate Payload types after scaffolding
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
