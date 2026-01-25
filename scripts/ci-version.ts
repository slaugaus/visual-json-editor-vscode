#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const packageJsonPath = path.join(import.meta.dir, "..", "package.json");

const commitHash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const baseVersion = packageJson.version.split("-ci-")[0];

const newVersion = `${baseVersion}-ci-${commitHash}`;

packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

console.log(`Updated version to ${newVersion}`);
