'use strict';

import os from 'os';
import path from 'path';
import log from './logger';
import nodegit from 'nodegit';
import fs from 'fs-extra-promise';
import pkg from '../../package.json';
import inquirer from 'inquirer';
import request from 'request-promise';

let config;
let repos;
let defaultConfig;

const gitHubOpts = {
  url: `https://api.github.com/`,
  headers: {
    "User-Agent": pkg.name,
    //Authorization: `token ${.github.token}`,
    Accept: `application/vnd.github.v3+json`,
    "Cache-Control": `no-cache,no-store`
  },
  json: true,
  timeout: 20000,
  pool: {
    maxSockets: 2
  }
};

/**
 * Blocking sleep function :(
 * @method sleep
 * @param {Number} [ms=4000] number of milliseconds to sleep for
 * @private
 */
function sleep(ms = 1100) {
  const waitTimeInMilliseconds = new Date().getTime() + ms;
  while (new Date().getTime() < waitTimeInMilliseconds) {
    true;
  }
}

/**
 * Simple deep object clone.
 * @method _clone
 * @param {Object} obj to be cloned
 * @return {Object} clone
 */
function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
/**
 * Clone repo to `config.target`.
 * @method _cloneRepo
 * @param {string} name repo name
 * @param {string} repoUrl url repo url
 * @return {Promise}
 */
async function _cloneRepo(backups, name, repoUrl) {
  try {
    log.info(`Cloning repo ${backups}:${name}:${repoUrl}`);
    const cloneOptions = {
      fetchOpts: {
        callbacks: {
          certificateCheck: () => {
            return 1;
          },
          credentials: () => {
            return nodegit.Cred.userpassPlaintextNew(config.token, `x-oauth-basic`);
          }
        }
      }
    };
    const repo = await nodegit.Clone(repoUrl, path.join(backups, name), cloneOptions); // eslint-disable-line new-cap
    return repo;
  } catch (err) {
    log.error(`cloneRepo failed for ${name}`);
    throw err;
  }
}

/**
 * Get config file
 * @method _getConfig
 * @private
 */
async function _getConfig() {
  try {
    config = await fs.readJsonAsync(path.join(os.homedir(), `.${pkg.name}.json`));
    let valid = true;
    for (let key in config) {
      if (String(config[key]).search(/{{[\w\d]*}}/) !== -1) {
        log.warn(`Invalid config item ${key}: ${config[key]}`);
        valid = false;
      }
    }
    if (valid) {
      gitHubOpts.headers.Authorization = `token ${config.token}`;
    } else {
      throw new Error(`Bad config details.`);
    }
  } catch (e) {
    log.debug(`_getConfig failed!`);
    throw e;
  }
}

/**
 * Get config file
 * @method _getDefaultConfig
 * @private
 */
async function _getDefaultConfig() {
  try {
    if (fs.existsSync(path.join(os.homedir(), `.${pkg.name}.json`))) {
      defaultConfig = await fs.readJsonAsync(path.join(os.homedir(), `.${pkg.name}.json`));
    } else {
      defaultConfig = await fs.readJsonAsync(path.resolve(path.join(__dirname, `../../.config.json`)));
    }
  } catch (e) {
    log.debug(`_getConfig failed!`);
    throw e;
  }
}

/**
 * Get known repos for user or organisation
 * @method _getRepos
 * @return {Promise}
 * @private
 */
async function _getRepos() {
  const options = _clone(gitHubOpts);
  options.url += config.isOrg ? `orgs/${config.owner}/repos?per_page=100` : `users/${config.owner}/repos?per_page=100`;
  try {
    repos = await request(options);
    return `fetched`;
  } catch (err) {
    throw new Error(err);
  }
}

/**
 * Driver method for backing up github repos.
 * @method _backup
 */
async function _backup() {
  try {
    // pseudo code:
    // test for .old-git-backups
    // - if it exists, remove it
    // test for .git-backups directory
    // - if it exists rename as .old-git-backups
    // - remove .git-backups
    // create .git-backups
    //
    // for each repo:
    // - clone to .gitbackups

    const oldBackups = path.join(`${config.backupDir}`, `.old-git-backups`);
    const backups    = path.join(`${config.backupDir}`, `.git-backups`);

    log.debug(`cull old backups`);
    await fs.removeAsync(oldBackups);

    log.debug(`check/create ${config.backupDir}/.git-backups`);
    await fs.ensureDirAsync(backups);

    log.debug(`copy current backups to .old-git-backups`);
    await fs.moveAsync(backups, oldBackups);

    log.debug(`cull current backups`);
    await fs.emptyDirAsync(backups);


    log.debug(`start cloning!`);
    for (let repo of repos) {
      sleep();
      await _cloneRepo(backups, repo.name, repo.clone_url);
    }

    log.info(`backup complete`);
  } catch (err) {
    log.error(`_backup failed`);
    throw err;
  }
}

async function _query() {
  // "owner": "{{org|user}}",
  // "isOrg": false,
  // "user": "{{user}}",
  // "token": "{{token}}",
  // "backupDir": "{{/path/to/backups}}"
  const questions = [{
    type: `input`,
    name: `owner`,
    message: `Repo owner (org or user):`,
    default: `${defaultConfig.owner}`
  }, {
    type: `confirm`,
    name: `isOrg`,
    message: `Is the owner an organisation?:`,
    default: `${defaultConfig.isOrg}`
  }, {
    type: `input`,
    name: `user`,
    message: `Github user:`,
    default: `${defaultConfig.user}`
  }, {
    type: `input`,
    name: `token`,
    message: `Github personal access token:`,
    default: `${defaultConfig.token}`
  }, {
    type: `input`,
    name: `backupDir`,
    message: `Location to back up to:`,
    default: `${os.homedir()}`
  }];

  return await inquirer.prompt(questions);
}

/**
 * List known gitlab and github repos
 * @method projects
 */
export function list() {
  _getConfig()
    .then(() => {
      return _getRepos();
    })
    .then(status => {
      log.debug(status);
      log.info(`Known repos (${repos.length}):`);
      for (const repo of repos) {
        log.info(`=> ${repo.id}:${repo.name}:${repo.clone_url}`);
      }
      return true;
    })
    .catch(err => {
      log.error(err);
    });
}

/**
 * Show config details.
 * @method showConfig
 */
export function showConfig() {
  log.info(`show config`);
  _getConfig()
    .then(() => {
      log.info(config);
      return true;
    })
    .catch(err => {
      log.error(err);
    });
}

/**
 * Backup known repos to back location.
 * @method backup
 */
export function backup() {
  log.info(`backup`);
  _getConfig()
    .then(() => {
      return _getRepos();
    })
    .then(status => {
      log.info(`Known repos (${repos.length}):`);
      return _backup();
    })
    .catch(err => {
      log.error(err);
    });
}

export function createConfig() {
  log.info(`create config`);
  _getDefaultConfig()
    .then(() => {
      return _query();
    })
    .then(newConfig => {
      console.log(newConfig);
      return fs.writeFileAsync(path.join(os.homedir(), `.${pkg.name}.json`), JSON.stringify(newConfig, null, 2), `utf8`);
    })
    .catch(err => {
      log.error(err);
    });
}
