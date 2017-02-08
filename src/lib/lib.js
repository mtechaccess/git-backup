'use strict';

import log from './logger';
import nodegit from 'nodegit';
import fs from 'fs-extra-promise';

let config;

/**
 * Clone repo to `config.target`.
 * @method _clone
 * @param {string} name repo name
 * @param {string} repoUrl url repo url
 * @return {Promise}
 */
function _clone(name, repoUrl) {
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
    config = await fs.readJsonASync(`../../config.json`);
  } catch (e) {
    log.debug(`No config found!`);
    throw e;
  }
}

export function backup() {
  log.info(`backup`);
}

export function list() {
  log.info(`list`);
}
