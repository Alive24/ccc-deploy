# ccc-deploy

A new CLI generated with oclif

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ccc-deploy.svg)](https://npmjs.org/package/ccc-deploy)
[![Downloads/week](https://img.shields.io/npm/dw/ccc-deploy.svg)](https://npmjs.org/package/ccc-deploy)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g ccc-deploy
$ ccc-deploy COMMAND
running command...
$ ccc-deploy (--version)
ccc-deploy/0.0.0 linux-x64 node-v20.17.0
$ ccc-deploy --help [COMMAND]
USAGE
  $ ccc-deploy COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`ccc-deploy hello PERSON`](#ccc-deploy-hello-person)
- [`ccc-deploy hello world`](#ccc-deploy-hello-world)
- [`ccc-deploy help [COMMAND]`](#ccc-deploy-help-command)
- [`ccc-deploy plugins`](#ccc-deploy-plugins)
- [`ccc-deploy plugins add PLUGIN`](#ccc-deploy-plugins-add-plugin)
- [`ccc-deploy plugins:inspect PLUGIN...`](#ccc-deploy-pluginsinspect-plugin)
- [`ccc-deploy plugins install PLUGIN`](#ccc-deploy-plugins-install-plugin)
- [`ccc-deploy plugins link PATH`](#ccc-deploy-plugins-link-path)
- [`ccc-deploy plugins remove [PLUGIN]`](#ccc-deploy-plugins-remove-plugin)
- [`ccc-deploy plugins reset`](#ccc-deploy-plugins-reset)
- [`ccc-deploy plugins uninstall [PLUGIN]`](#ccc-deploy-plugins-uninstall-plugin)
- [`ccc-deploy plugins unlink [PLUGIN]`](#ccc-deploy-plugins-unlink-plugin)
- [`ccc-deploy plugins update`](#ccc-deploy-plugins-update)

## `ccc-deploy hello PERSON`

Say hello

```
USAGE
  $ ccc-deploy hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ ccc-deploy hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/pausable-udt/ccc-deploy/blob/v0.0.0/src/commands/hello/index.ts)_

## `ccc-deploy hello world`

Say hello world

```
USAGE
  $ ccc-deploy hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ ccc-deploy hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/pausable-udt/ccc-deploy/blob/v0.0.0/src/commands/hello/world.ts)_

## `ccc-deploy help [COMMAND]`

Display help for ccc-deploy.

```
USAGE
  $ ccc-deploy help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for ccc-deploy.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.20/src/commands/help.ts)_

## `ccc-deploy plugins`

List installed plugins.

```
USAGE
  $ ccc-deploy plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ ccc-deploy plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/index.ts)_

## `ccc-deploy plugins add PLUGIN`

Installs a plugin into ccc-deploy.

```
USAGE
  $ ccc-deploy plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into ccc-deploy.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CCC_DEPLOY_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CCC_DEPLOY_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ ccc-deploy plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ ccc-deploy plugins add myplugin

  Install a plugin from a github url.

    $ ccc-deploy plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ ccc-deploy plugins add someuser/someplugin
```

## `ccc-deploy plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ ccc-deploy plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ ccc-deploy plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/inspect.ts)_

## `ccc-deploy plugins install PLUGIN`

Installs a plugin into ccc-deploy.

```
USAGE
  $ ccc-deploy plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into ccc-deploy.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CCC_DEPLOY_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CCC_DEPLOY_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ ccc-deploy plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ ccc-deploy plugins install myplugin

  Install a plugin from a github url.

    $ ccc-deploy plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ ccc-deploy plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/install.ts)_

## `ccc-deploy plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ ccc-deploy plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ ccc-deploy plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/link.ts)_

## `ccc-deploy plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ ccc-deploy plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ ccc-deploy plugins unlink
  $ ccc-deploy plugins remove

EXAMPLES
  $ ccc-deploy plugins remove myplugin
```

## `ccc-deploy plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ ccc-deploy plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/reset.ts)_

## `ccc-deploy plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ ccc-deploy plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ ccc-deploy plugins unlink
  $ ccc-deploy plugins remove

EXAMPLES
  $ ccc-deploy plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/uninstall.ts)_

## `ccc-deploy plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ ccc-deploy plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ ccc-deploy plugins unlink
  $ ccc-deploy plugins remove

EXAMPLES
  $ ccc-deploy plugins unlink myplugin
```

## `ccc-deploy plugins update`

Update installed plugins.

```
USAGE
  $ ccc-deploy plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.24/src/commands/plugins/update.ts)_

<!-- commandsstop -->
