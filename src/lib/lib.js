'use strict';

import log from './logger';
import nodegit from 'nodegit';
import fs from 'fs-extra-promise';
import pkg from '../../package.json';
import request from 'request-promise';

let config;
let repos;
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
function _cloneRepo(name, repoUrl) {
  return new Promise((resolve, reject) => {
    log.info(`Cloning repo ${name}`);
    const cloneOptions = {
      fetchOpts: {
        callbacks: {
          certificateCheck: () => {
            return 1;
          },
          credentials: (url, userName) => {
            return nodegit.Cred.sshKeyFromAgent(userName);
          }
        }
      }
    };
    nodegit.Clone(url, config.target, cloneOptions) // eslint-disable-line new-cap
      .then(repo => {
        log.debug(`=> repo fetched: ${repo.path()}`);
        resolve(repo);
      })
      .catch(err => {
        log.error(err);
        reject(err);
      });
  });
}

/**
 * Get config file
 * @method _getConfig
 * @private
 */
async function _getConfig() {
  try {
    config                           = await fs.readJsonAsync(`config.json`);
    gitHubOpts.headers.Authorization = `token ${config.token}`;
  } catch (e) {
    log.debug(`No config found!`);
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
  console.log(options);
  try {
    repos = await request(options);
    return `fetched`;
  } catch (err) {
    throw new Error(err);
  }
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
        log.info(`=> ${repo.id}:${repo.name}:${repo.url}`);
      }
    })
    .catch(err => {
      log.error(err);
    });
}

export function showConfig() {
  log.info(`show config`);
  _getConfig()
    .then(() => {
      log.info(config);
    })
    .catch(err => {
      log.error(err);
    });
}

export function backup() {
  log.info(`backup`);
}
