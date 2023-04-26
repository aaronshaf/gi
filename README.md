## Install

```bash
npm i -g @aaronshaf/ger
```

## Assumption: gerrit in known_hosts

```
# ~/.ssh/known_hosts
Host gerrit
  HostName gerrit.[your domain].com
  User [your username]
  Port 29418
```

## Usage

```bash
# list branches with gerrit info
ger branch

# list branches with expanded gerrit info
ger branch -v

# prompt to delete already-merged branches
ger branch -d
```