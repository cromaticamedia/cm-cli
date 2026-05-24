import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs/promises'
import path from 'path'

const BANK_API_URL = 'https://bank.cromatica.media/api'
const SYSTEM_BLOCKS = ['Fallback']

// ── Utils ─────────────────────────────────────────────────────────────────────

function toKebabCase(pascal: string): string {
  return pascal.replace(
    /([A-Z])/g,
    (_, letter, offset) => (offset > 0 ? '-' : '') + letter.toLowerCase(),
  )
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

// ── Parse installed blocks from Blocks.field.ts ───────────────────────────────

async function getInstalledBlocks(): Promise<string[]> {
  const blocksFieldPath = path.join(process.cwd(), 'src', 'fields', 'Blocks', 'Blocks.field.ts')
  const content = await fs.readFile(blocksFieldPath, 'utf-8')

  const importRegex = /^import\s+\w+\s+from\s+'@\/blocks\/(\w+)'/gm
  const blocks: string[] = []
  let match

  while ((match = importRegex.exec(content)) !== null) {
    blocks.push(match[1]) // captura el nombre de la carpeta: "Fallback", "HeroCardsGrid"
  }

  return blocks
}

// ── Fetch block status from Bank API ─────────────────────────────────────────

async function fetchBlockStatus(
  kebabName: string,
): Promise<{ label: string; status: string } | null> {
  try {
    const url = `${BANK_API_URL}/blocks?where[slug][equals]=${kebabName}&depth=0&limit=1`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as {
      docs: Array<{ label: string; status: string }>
    }
    if (!data.docs.length) return null
    return data.docs[0]
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function listBlocks() {
  console.log('')
  console.log(chalk.bold.blue(`  cromatica`) + chalk.gray(` — list blocks`))
  console.log('')

  // 0. Validate project
  const validateSpinner = ora(`Validating project structure`).start()
  try {
    await validateProject()
    validateSpinner.succeed(`Valid cm-template-website project detected`)
  } catch (err) {
    validateSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  // 1. Parse installed blocks
  const installedSpinner = ora(`Reading installed blocks`).start()
  let installedBlocks: string[] = []
  try {
    installedBlocks = await getInstalledBlocks()
    installedSpinner.succeed(`Found ${chalk.cyan(installedBlocks.length)} installed block(s)`)
  } catch (err) {
    installedSpinner.fail(chalk.red((err as Error).message))
    process.exit(1)
  }

  if (installedBlocks.length === 0) {
    console.log(chalk.gray('\n  No blocks installed yet.\n'))
    return
  }

  // 2. Fetch status from Bank for each block
  console.log('')
  const fetchSpinner = ora(`Checking block status on Bank`).start()

  const results = await Promise.all(
    installedBlocks.map(async (pascalName) => {
      const kebabName = toKebabCase(pascalName)
      const bankData = await fetchBlockStatus(kebabName)
      return { pascalName, kebabName, bankData }
    }),
  )

  fetchSpinner.succeed(`Block status fetched`)
  console.log('')

  // 3. Print results
  const labelCol = 28
  console.log(chalk.gray(`  ${'Block'.padEnd(labelCol)}${'Slug'.padEnd(labelCol)}Status`))
  console.log(chalk.gray(`  ${'─'.repeat(labelCol + labelCol + 10)}`))

  for (const { pascalName, kebabName, bankData } of results) {
    const isSystem = SYSTEM_BLOCKS.includes(pascalName)
    const label = isSystem
      ? chalk.gray(pascalName.padEnd(labelCol))
      : chalk.white(pascalName.padEnd(labelCol))
    const slug = isSystem
      ? chalk.gray(kebabName.padEnd(labelCol))
      : chalk.cyan(kebabName.padEnd(labelCol))

    let status: string
    if (isSystem) {
      status = chalk.gray('system')
    } else if (!bankData) {
      status = chalk.yellow('not found in Bank')
    } else if (bankData.status === 'stable') {
      status = chalk.green('stable')
    } else if (bankData.status === 'beta') {
      status = chalk.yellow('beta')
    } else {
      status = chalk.gray(bankData.status)
    }

    console.log(`  ${label}${slug}${status}`)
  }

  console.log('')
}
