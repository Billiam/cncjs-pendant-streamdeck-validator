#!/usr/bin/env node

import chalk from 'chalk'
import { program } from 'commander'
import { version } from '../package.json'
import { validatePath } from './lib/cli'

program
  .version(version)
  .option('-c, --config <config>', 'path to config file')
  .option('-q, --quiet', 'silence validation output')
  .parse()

const options = program.opts()
if (options.config) {
  const result = validatePath(options.config)
  if (result.status === 'error') {
    if (!options.quiet) {
      result.errors.forEach((error) => {
        console.error(chalk[error.color](error.message))
      })
    }

    process.exit(1)
  } else {
    if (!options.quiet) {
      console.log(chalk.green('✓ Config validated'))
    }
  }
} else {
  program.outputHelp()
}
