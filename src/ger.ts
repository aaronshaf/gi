#!/usr/bin/env ts-node

import { Command } from '@commander-js/extra-typings';
import { branch } from "./commands/branch";

const version = require("../package.json").version;

const program = new Command();
program.name("ger").description("Gerrit CLI").version(version);

program
  .command("branch")
  .description("Get a list of local branches with Gerrit info")
  .option("-v", "Show extra information, i.e. approvals")
  .action((
    _program: any,
  ) => {
    branch(_program);
  });

program.parse();
