#!/usr/bin/env node
'use strict';

import * as log from '@mtechaccess/logger';
import * as commander from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as lib from '../lib/lib';
const pkg = fs.readJsonSync(path.resolve(__dirname, `..`, `..`, 'package.json'));

// ====================================
// main
console.log(`${pkg.name} ${pkg.version}`);

commander
  .version(pkg.version)
  .option(`-l, --list`, `List known repos in config.json`)
  .option(`-c, --config`, `Show config`)
  .option(`-i, --init`, `create config (~/.git-backup.json)`)
  .option(`-b, --backup`, `Clone know repos defined in config.json`)
  .option(`-D, --debug`, `enable debug messages`)
  .parse(process.argv);

if (commander.debug) {
  log.enableDebug(true);
}

if (commander.backup) {
  lib.backup();
} else if (commander.init) {
  lib.createConfig();
} else if (commander.config) {
  lib.showConfig();
} else {
  lib.list();
}
