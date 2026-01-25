#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.join(import.meta.dir, '..', 'package.json');

const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const baseVersion = packageJson.version.split('-ci-')[0];

const newVersion = `${baseVersion}-ci-${commitHash}`;

packageJson.version = newVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Updated version to ${newVersion}`);
