import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs/promises'
import { execSync } from 'child_process'
import path from 'path'

// ── Utils ─────────────────────────────────────────────────────────────────────

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// ── Validate project structure ────────────────────────────────────────────────

async function validateProject() {
  const requiredPaths = [
    path.join(process.cwd(), 'src', 'fields', 'Blocks', 'Blocks.field.ts'),
    path.join(process.cwd(), 'src', 'components', 'blocks', 'RenderBlocks.tsx'),
    path.join(process.cwd(), 'src', 'blocks'),
  ]

  for (const requiredPath of requiredPaths) {
    const exists = await fileExists(requiredPath)
    if (!exists) {
      throw new Error(
        `This command must be run inside a cm-template-website project or in a fork of itself.\n  Missing: ${requiredPath}`,
      )
    }
  }
}

// ── Remove component files ────────────────────────────────────────────────────

async function removeComponentFiles(pascalName: string) {
  const componentDir = path.join(process.cwd(), 'src', 'components', 'blocks', pascalName)
  const exists = await fileExists(componentDir)
  if (!exists) return false
  await fs.rm(componentDir, { recursive: true, force: true })
  return true
}

// ── Remove block schema files ─────────────────────────────────────────────────

async function removeBlockFiles(pascalName: string) {
  const blockDir = path.join(process.cwd(), 'src', 'blocks', pascalName)
  const exists = await fileExists(blockDir)
  if (!exists) return false
  await fs.rm(blockDir, { recursive: true, force: true })
  return true
}

// ── Remove block from Blocks.field.ts ────────────────────────────────────────

async function removeFromBlocksField(pascalName: string) {
  const blocksFieldPath = path.join(process.cwd(), 'src', 'fields', 'Blocks', 'Blocks.field.ts')

  const exists = await fileExists(blocksFieldPath)
  if (!exists) throw new Error(`Blocks.field.ts not found at ${blocksFieldPath}`)

  let content = await fs.readFile(blocksFieldPath, 'utf-8')

  const importLine = `import ${pascalName}Block from '@/blocks/${pascalName}'`
  if (!content.includes(importLine)) return false

  // Remove import line
  content = content.replace(importLine + '\n', '')

  // Remove from blocks array — handles ", BlockName" or "BlockName, " patterns
  content = content.replace(new RegExp(`,\\s*${pascalName}Block`, 'g'), '')
  content = content.replace(new RegExp(`${pascalName}Block,\\s*`, 'g'), '')

  await fs.writeFile(blocksFieldPath, content, 'utf-8')
  return true
}

// ── Remove block from RenderBlocks.tsx ───────────────────────────────────────

async function removeFromRenderBlocks(blockName: string, pascalName: string) {
  const renderBlocksPath = path.join(
    process.cwd(),
    'src',
    'components',
    'blocks',
    'RenderBlocks.tsx',
  )

  const exists = await fileExists(renderBlocksPath)
  if (!exists) throw new Error(`RenderBlocks.tsx not found at ${renderBlocksPath}`)

  let content = await fs.readFile(renderBlocksPath, 'utf-8')

  const importLine = `import ${pascalName} from '@/components/blocks/${pascalName}'`
  if (!content.includes(importLine)) return false

  // Remove import line
  content = content.replace(importLine + '\n', '')

  // Remove Extract type line
  content = content.replace(
    new RegExp(
      `type ${pascalName}Type = Extract<Layout\\[number\\], \\{ blockType: '${blockName}' \\}>\\n`,
      'g',
    ),
    '',
  )

  // Remove case block (case + return + newline)
  content = content.replace(
    new RegExp(`\\s*case '${blockName}':\\n\\s*return <${pascalName}[^\\n]*\\n`, 'g'),
    '\n',
  )

  await fs.writeFile(renderBlocksPath, content, 'utf-8')
  return true
}

// ── Generate Payload types ────────────────────────────────────────────────────

function generateTypes() {
  const hasPnpm = (() => {
    try {
      execSync('pnpm --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  const cmd = hasPnpm ? 'pnpm payload generate:types' : 'npx payload generate:types'
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function deleteBlock(blockName: string) {
  const pascalName = toPascalCase(blockName)

  console.log('')
  console.log(chalk.bold.blue(`  cromatica`) + chalk.gray(` — delete block`))
  console.log(chalk.gray(`  Removing "${blockName}" from the project...\n`))

  // 0. Validate project
  const validateSpinner = ora(`Validating project structure`).start()
  try {
    await validateProject()
    validateSpinner.succeed(`Valid cm-template-website project detected`)
  } catch (err) {
    validateSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 1. Remove component files
  const componentSpinner = ora(`Removing component files`).start()
  try {
    const removed = await removeComponentFiles(pascalName)
    if (removed) {
      componentSpinner.succeed(`Removed ${chalk.green(`src/components/blocks/${pascalName}/`)}`)
    } else {
      componentSpinner.warn(
        `${chalk.yellow(`src/components/blocks/${pascalName}/`)} not found, skipping`,
      )
    }
  } catch (err) {
    componentSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 2. Remove block schema files
  const schemaSpinner = ora(`Removing Payload schema files`).start()
  try {
    const removed = await removeBlockFiles(pascalName)
    if (removed) {
      schemaSpinner.succeed(`Removed ${chalk.green(`src/blocks/${pascalName}/`)}`)
    } else {
      schemaSpinner.warn(`${chalk.yellow(`src/blocks/${pascalName}/`)} not found, skipping`)
    }
  } catch (err) {
    schemaSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 3. Remove from Blocks.field.ts
  const injectSpinner = ora(`Removing block from Blocks.field.ts`).start()
  try {
    const removed = await removeFromBlocksField(pascalName)
    if (removed) {
      injectSpinner.succeed(`Removed ${chalk.green(`${pascalName}Block`)} from Blocks.field.ts`)
    } else {
      injectSpinner.warn(`${chalk.yellow(`${pascalName}Block`)} was not found in Blocks.field.ts`)
    }
  } catch (err) {
    injectSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 4. Remove from RenderBlocks.tsx
  const renderSpinner = ora(`Removing block from RenderBlocks.tsx`).start()
  try {
    const removed = await removeFromRenderBlocks(blockName, pascalName)
    if (removed) {
      renderSpinner.succeed(`Removed ${chalk.green(`${pascalName}`)} from RenderBlocks.tsx`)
    } else {
      renderSpinner.warn(`${chalk.yellow(`${pascalName}`)} was not found in RenderBlocks.tsx`)
    }
  } catch (err) {
    renderSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 5. Generate Payload types
  const typesSpinner = ora(`Generating Payload types`).start()
  try {
    generateTypes()
    typesSpinner.succeed(`Payload types regenerated`)
  } catch (err) {
    typesSpinner.fail(
      chalk.red(`Failed to generate types — run "pnpm payload generate:types" manually`),
    )
  }

  // Done
  console.log('')
  console.log(chalk.bold.green('  ✔ Block removed successfully'))
  console.log('')
  console.log(`  ${chalk.gray('Removed')}     src/components/blocks/${pascalName}/`)
  console.log(`  ${chalk.gray('Removed')}     src/blocks/${pascalName}/`)
  console.log(`  ${chalk.gray('Updated')}     src/fields/Blocks/Blocks.field.ts`)
  console.log(`  ${chalk.gray('Updated')}     src/components/blocks/RenderBlocks.tsx`)
  console.log(`  ${chalk.gray('Types')}       src/payload-types.ts`)
  console.log('')
}
