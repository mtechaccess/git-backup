# git-backup

Clone all repos for a known user or organisation

- `npm install`
- `gulp build`
- `npm link`
- run `git-backup --init` to create/edit config file
  - `owner`: user or organisation to back up from
  - `isOrg`: boolean, if true, assume owner is an organisation
  - `user`: github user performing backup
  - `token`: github personal access token, required by github API
  - `backupDir`: location to backup to, i.e `/Users/<name>` (on macOS)
- on macOS, edit the `uk.co.mtechaccess.git-backup.plist` so the 1st string in the `ProgramArguments` points to the linked binary

```
<key>ProgramArguments</key>
<array>
  <string>/Users/loki/.npm-packages/bin/git-backup</string>
  <string>-b</string>
</array>
```

You can find out where this is using the following command in the terminal: `which git-backup`

Then copy the plist to the `~/Library/LaunchAgents` directory.
Finally, load it: `launchctl load ~/Library/LaunchAgents/uk.co.mtechaccess.git-backup.plist`

You can check if the service loaded correctly thus: `launchctl list | grep git-backup`
