#!/usr/bin/env node
'use strict';
import "babel-polyfill";

import commander from 'commander';
import log from '../lib/logger';
import * as lib from '../lib/lib';
import pkg from '../../package.json';

// ====================================
// main
log.info(`${pkg.name} ${pkg.version}`);

commander
  .version(pkg.version)
  .option(`-l, --list`, `List known repos in config.json`)
  .option(`-c, --config`, `Show config`)
  .option(`-b, --backup`, `Clone know repos defined in config.json`)
  .option(`-D, --debug`, `enable debug messages`)
  .parse(process.argv);

if (commander.debug) {
  log.transports.console.level = `debug`;
}

if (commander.backup) {
  lib.backup();
} else if (commander.config) {
  lib.showConfig();
} else {
  lib.list();
}
