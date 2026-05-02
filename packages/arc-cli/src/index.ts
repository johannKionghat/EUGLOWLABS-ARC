#!/usr/bin/env node
import { buildCli } from "./cli.js";

void buildCli().runExit(process.argv.slice(2));
