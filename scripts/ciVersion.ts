#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import packageJson from '../package.json';

const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

const [baseVersion] = packageJson.version.split('-ci-');

const newVersion = `${baseVersion}-ci-${commitHash}`;

const newPackage = { ...packageJson, version: newVersion };

const packageJsonPath = path.join(import.meta.dir, '..', 'package.json');

writeFileSync(packageJsonPath, `${JSON.stringify(newPackage, undefined, 2)}\n`);

console.log(`Updated version to ${newVersion}`);
