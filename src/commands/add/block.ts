import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs/promises'
import { execSync } from 'child_process'
import path from 'path'

const BANK_API_URL = 'https://bank.cromatica.media/api'

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

// ── Fetch block from Bank API ─────────────────────────────────────────────────

async function fetchBlock(blockName: string) {
  const url = `${BANK_API_URL}/blocks?where[name][equals]=${blockName}&depth=0&limit=1`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Bank API responded with status ${response.status}`)
  }

  const data = (await response.json()) as {
    docs: Array<{
      name: string
      files: {
        componentTsx: string
        blockTs: string
      }
    }>
  }

  if (!data.docs.length) {
    throw new Error(`Block "${blockName}" not found in the Block Bank`)
  }

  return data.docs[0]
}

// ── Create component files ────────────────────────────────────────────────────

async function createComponentFiles(pascalName: string, componentTsx: string) {
  const componentDir = path.join(process.cwd(), 'src', 'components', 'blocks', pascalName)

  await fs.mkdir(componentDir, { recursive: true })

  await fs.writeFile(path.join(componentDir, `${pascalName}.tsx`), componentTsx, 'utf-8')

  await fs.writeFile(
    path.join(componentDir, 'index.ts'),
    `export { default } from './${pascalName}'\n`,
    'utf-8',
  )
}

// ── Create block schema files ─────────────────────────────────────────────────

async function createBlockFiles(pascalName: string, blockTs: string) {
  const blockDir = path.join(process.cwd(), 'src', 'blocks', pascalName)

  await fs.mkdir(blockDir, { recursive: true })

  await fs.writeFile(path.join(blockDir, `${pascalName}.block.ts`), blockTs, 'utf-8')

  await fs.writeFile(
    path.join(blockDir, 'index.ts'),
    `export { default } from './${pascalName}.block'\n`,
    'utf-8',
  )
}

// ── Inject block into Blocks.field.ts ─────────────────────────────────────────

async function injectIntoBlocksField(pascalName: string) {
  const blocksFieldPath = path.join(process.cwd(), 'src', 'fields', 'Blocks', 'Blocks.field.ts')

  const exists = await fileExists(blocksFieldPath)
  if (!exists) {
    throw new Error(`Blocks.field.ts not found at ${blocksFieldPath}`)
  }

  let content = await fs.readFile(blocksFieldPath, 'utf-8')

  const importLine = `import ${pascalName}Block from '@/blocks/${pascalName}'`

  if (content.includes(importLine)) {
    return false
  }

  const lastImportIndex = content.lastIndexOf('import ')
  const endOfLastImport = content.indexOf('\n', lastImportIndex)
  content =
    content.slice(0, endOfLastImport + 1) + importLine + '\n' + content.slice(endOfLastImport + 1)

  content = content.replace(
    /blocks:\s*\[([^\]]*)\]/,
    (_, inner) => `blocks: [${inner.trimEnd()}, ${pascalName}Block]`,
  )

  await fs.writeFile(blocksFieldPath, content, 'utf-8')
  return true
}

// ── Inject block into RenderBlocks.tsx ───────────────────────────────────────

async function injectIntoRenderBlocks(blockName: string, pascalName: string) {
  const renderBlocksPath = path.join(
    process.cwd(),
    'src',
    'components',
    'blocks',
    'RenderBlocks.tsx',
  )

  const exists = await fileExists(renderBlocksPath)
  if (!exists) {
    throw new Error(`RenderBlocks.tsx not found at ${renderBlocksPath}`)
  }

  let content = await fs.readFile(renderBlocksPath, 'utf-8')

  const importLine = `import ${pascalName} from '@/components/blocks/${pascalName}'`

  if (content.includes(importLine)) {
    return false
  }

  // Add import after last import line
  const lastImportIndex = content.lastIndexOf('import ')
  const endOfLastImport = content.indexOf('\n', lastImportIndex)
  content =
    content.slice(0, endOfLastImport + 1) + importLine + '\n' + content.slice(endOfLastImport + 1)

  // Add case to switch
  const caseLine = `          case '${blockName}':\n            return <${pascalName} key={index} {...block} locale={locale} />`

  content = content.replace(/(default:\s*\n\s*return null)/, `${caseLine}\n          $1`)

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

export async function addBlock(blockName: string) {
  const pascalName = toPascalCase(blockName)

  console.log('')
  console.log(chalk.bold.blue(`  cromatica`) + chalk.gray(` — add block`))
  console.log(chalk.gray(`  Fetching "${blockName}" from the Block Bank...\n`))

  // 0. Validate project
  const validateSpinner = ora(`Validating project structure`).start()
  try {
    await validateProject()
    validateSpinner.succeed(`Valid cm-template-website project detected`)
  } catch (err) {
    validateSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 1. Fetch
  const spinner = ora(`Fetching ${chalk.cyan(blockName)} from Block Bank`).start()
  let block: Awaited<ReturnType<typeof fetchBlock>>
  try {
    block = await fetchBlock(blockName)
    spinner.succeed(`Block ${chalk.cyan(blockName)} found`)
  } catch (err) {
    spinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 2. Create component files
  const componentSpinner = ora(`Creating component files`).start()
  try {
    await createComponentFiles(pascalName, block.files.componentTsx)
    componentSpinner.succeed(`Created ${chalk.green(`src/components/blocks/${pascalName}/`)}`)
  } catch (err) {
    componentSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 3. Create block schema files
  const schemaSpinner = ora(`Creating Payload schema files`).start()
  try {
    await createBlockFiles(pascalName, block.files.blockTs)
    schemaSpinner.succeed(`Created ${chalk.green(`src/blocks/${pascalName}/`)}`)
  } catch (err) {
    schemaSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 4. Inject into Blocks.field.ts
  const injectSpinner = ora(`Injecting block into Blocks.field.ts`).start()
  try {
    const injected = await injectIntoBlocksField(pascalName)
    if (injected) {
      injectSpinner.succeed(`Injected ${chalk.green(`${pascalName}Block`)} into Blocks.field.ts`)
    } else {
      injectSpinner.warn(`${chalk.yellow(`${pascalName}Block`)} was already in Blocks.field.ts`)
    }
  } catch (err) {
    injectSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 5. Inject into RenderBlocks.tsx
  const renderSpinner = ora(`Injecting block into RenderBlocks.tsx`).start()
  try {
    const injected = await injectIntoRenderBlocks(blockName, pascalName)
    if (injected) {
      renderSpinner.succeed(`Injected ${chalk.green(`${pascalName}`)} into RenderBlocks.tsx`)
    } else {
      renderSpinner.warn(`${chalk.yellow(`${pascalName}`)} was already in RenderBlocks.tsx`)
    }
  } catch (err) {
    renderSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 6. Generate Payload types
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
  console.log(chalk.bold.green('  ✔ Block added successfully'))
  console.log('')
  console.log(
    `  ${chalk.gray('Component')}   src/components/blocks/${pascalName}/${pascalName}.tsx`,
  )
  console.log(`  ${chalk.gray('Schema')}      src/blocks/${pascalName}/${pascalName}.block.ts`)
  console.log(`  ${chalk.gray('Injected')}    src/fields/Blocks/Blocks.field.ts`)
  console.log(`  ${chalk.gray('Injected')}    src/components/blocks/RenderBlocks.tsx`)
  console.log(`  ${chalk.gray('Types')}       src/payload-types.ts`)
  console.log('')
}
