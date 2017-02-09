# git-backup

Clone all repos for a known user or organisation

- `cp .config.json config.json`
- edit `config.json` as necessary

  - `owner`: user or organisation to back up from
  - `isOrg`: boolean, if true, assume owner is an organisation
  - `user`: github user performing backup
  - `token`: github personal access token, required by github API
  - `backupDir`: location to backup to, i.e `/Users/<name>` (on macOS)

- run `git-back --backup`
