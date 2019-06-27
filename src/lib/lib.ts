'use strict';

import * as gitOps from '@mtechaccess/git-ops';
import * as log from '@mtechaccess/logger';
import * as fs from 'fs-extra';
import * as got from 'got';
import * as inquirer from 'inquirer';
import * as os from 'os';
import * as path from 'path';

let config: any;
let defaultConfig: any;

const pkg = fs.readJsonSync(path.resolve(__dirname, `..`, `..`, 'package.json'));

const gitHubOpts = {
  headers: {
    'Accept': `application/vnd.github.v3+json`,
    'Authorization': ``,
    'Cache-Control': `no-cache,no-store`,
    'User-Agent': pkg.name
  },
  json: true,
  pool: {
    maxSockets: 2
  },
  timeout: 20000,
  url: `https://api.github.com/`
};

/**
 * Blocking sleep function :(
 * @method sleep
 * @param {Number} [ms=4000] number of milliseconds to sleep for
 * @private
 */
function sleep(ms: number = 1100) {
  const waitTimeInMilliseconds = new Date().getTime() + ms;
  while (new Date().getTime() < waitTimeInMilliseconds) {
    true;
  }
}

/**
 * Simple deep object clone.
 * @method _clone
 * @param {any} obj to be cloned
 * @return {any} clone
 */
function _clone(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get config file
 * @method _getConfig
 * @private
 */
async function _getConfig() {
  try {
    config = await fs.readJson(path.join(os.homedir(), `.git-backup.json`));
    let valid = true;
    for (const key in config) {
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
      defaultConfig = await fs.readJson(path.join(os.homedir(), `.${pkg.name}.json`));
    } else {
      defaultConfig = await fs.readJson(path.resolve(path.join(__dirname, `../../.config.json`)));
    }
  } catch (e) {
    log.debug(`_getConfig failed!`);
    throw e;
  }
}

/**
 * Get known repos for user or organisation
 * @method _getRepos
 * @return {Promise<any>}
 * @private
 */
async function _getRepos(): Promise<any> {
  const options = _clone(gitHubOpts);
  options.url += config.isOrg ? `orgs/${config.owner}/repos?per_page=100` : `users/${config.owner}/repos?per_page=100`;
  let repos: any[] = [];

  try {
    repos = await _getPage(options, repos);
    return repos;
  } catch (err) {
    console.error(err.toString());
    throw err;
  }
}

/**
 * Called recursively to get all pages of data form github
 *
 * @param {*} options request options
 * @param {any[]} repos current set of repos
 * @returns
 */
async function _getPage(options: any, repos: any[]) {
  try {
    const response = await got(options.url, options);
    repos = repos.concat(response.body);

    const links = response.headers.link.toString().split(`,`).map((l: string) => l.trim());

    if (links[0].includes(`; rel="next"`)) {
      options.url = links[0].split(`; rel="next"`)[0];
      options.url = options.url.replace(`<`, ``).replace(`>`, ``);
      repos = await _getPage(options, repos);
    }

    return repos;
  } catch (e) {
    throw e;
  }
}

/**
 * Driver method for backing up github repos.
 * @method _backup
 */
async function _backup(repos: any[]) {
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
    const backups = path.join(`${config.backupDir}`, `.git-backups`);

    log.debug(`cull old backups`);
    await fs.remove(oldBackups);

    log.debug(`check/create ${config.backupDir}/.git-backups`);
    await fs.ensureDir(backups);

    log.debug(`copy current backups to .old-git-backups`);
    await fs.move(backups, oldBackups);

    log.debug(`cull current backups`);
    await fs.emptyDir(backups);

    log.debug(`start cloning!`);
    for (const repo of repos) {
      sleep();
      const repoDir = path.join(backups, repo.name);
      await fs.mkdir(repoDir);
      await gitOps.cloneRepo({ clone: true }, repo.clone_url, repoDir);
    }

    log.info(`backup complete`);
  } catch (err) {
    log.error(`_backup failed`);
    throw err;
  }
}

/**
 *  Interactively build config items
 *
 * @returns
 */
async function _query() {
  // "owner": "{{org|user}}",
  // "isOrg": false,
  // "user": "{{user}}",
  // "token": "{{token}}",
  // "backupDir": "{{/path/to/backups}}"
  const questions = [{
    default: `${defaultConfig.owner}`,
    message: `Repo owner (org or user):`,
    name: `owner`,
    type: `input`
  }, {
    default: `${defaultConfig.isOrg}`,
    message: `Is the owner an organisation?:`,
    name: `isOrg`,
    type: `confirm`
  }, {
    default: `${defaultConfig.user}`,
    message: `Github user:`,
    name: `user`,
    type: `input`
  }, {
    default: `${defaultConfig.token}`,
    message: `Github personal access token:`,
    name: `token`,
    type: `input`
  }, {
    default: `${os.homedir()}`,
    message: `Location to back up to:`,
    name: `backupDir`,
    type: `input`
  }] as inquirer.Questions;

  return await inquirer.prompt(questions);
}

/**
 * List known gitlab and github repos
 * @method projects
 */
export async function list() {
  try {
    await _getConfig();
    const repos = await _getRepos();
    log.info(`Known repos (${repos.length}):`);
    for (const repo of repos) {
      log.info(`=> ${repo.id}:${repo.name}:${repo.clone_url}`);
    }
  } catch (e) {
    log.error(e);
  }
}

/**
 * Show config details.
 * @method showConfig
 */
export async function showConfig() {
  try {
    log.info(`show config`);
    await _getConfig();
    log.info(`%o`, config);

  } catch (err) {
    log.error(err.toString());
  }
}

/**
 * Backup known repos to back location.
 * @method backup
 */
export async function backup() {
  try {
    log.openLog(`git-backup`);
    log.info(`backup`);
    await _getConfig();
    const repos = await _getRepos();
    log.info(`Known repos (${repos.length})`);
    _backup(repos);
    log.closeLog();
  } catch (err) {
    log.error(err);
  }
}

/**
 * Create config
 *
 * @export
 */
export async function createConfig() {
  try {
    log.info(`create config`);
    await _getDefaultConfig();
    const newConfig = await _query();
    return fs.writeJson(path.join(os.homedir(), `.git-backup.json`), newConfig, { spaces: 2 });
  } catch (err) {
    log.error(err.toString());
  }
}
