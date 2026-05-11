#!/usr/bin/env node

import { program } from 'commander'
import chalk from 'chalk'
import { addBlock } from './commands/add/block.js'

program
  .name('cromatica')
  .description('Official CLI toolkit for Cromatica Media projects')
  .version('0.1.0')

program
  .command('add')
  .argument('<subcommand>', 'Subcommand to run (block)')
  .argument('<name>', 'Name of the resource to add')
  .description('Add a resource from the Block Bank')
  .action((subcommand: string, name: string) => {
    if (subcommand === 'block') {
      addBlock(name)
    } else {
      console.log(chalk.red(`  Unknown subcommand: ${subcommand}`))
      process.exit(1)
    }
  })

program.parse()
