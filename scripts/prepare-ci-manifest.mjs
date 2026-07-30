#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const packageLock = JSON.parse(readFileSync(lockPath, 'utf8'));

const dependencyName = '@types/papaparse';
const rootPackage = packageLock.packages?.[''];
if (!rootPackage?.devDependencies || !packageLock.packages) {
  throw new Error('package-lock root dependency metadata is unavailable');
}

const declaredVersion = packageJson.devDependencies?.[dependencyName];
const lockedPackage = packageLock.packages[`node_modules/${dependencyName}`];
if (declaredVersion !== '^5.5.2' || lockedPackage?.version !== '5.5.2') {
  throw new Error(`Unexpected ${dependencyName} contract: package=${declaredVersion}, lock=${lockedPackage?.version}`);
}

if (!packageJson.devDependencies) throw new Error('package.json devDependencies are unavailable');
delete packageJson.devDependencies[dependencyName];
delete rootPackage.devDependencies[dependencyName];
delete packageLock.packages[`node_modules/${dependencyName}`];

const packageContent = `${JSON.stringify(packageJson, null, 2)}\n`;
const lockContent = `${JSON.stringify(packageLock, null, 2)}\n`;
writeFileSync(packagePath, packageContent);
writeFileSync(lockPath, lockContent);

const digest = (value) => createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  schemaVersion: 'ci-manifest-normalization-1.0.0',
  removedDevelopmentTypePackage: `${dependencyName}@5.5.2`,
  replacementDeclaration: 'src/types/papaparse.d.ts',
  packageJsonSha256: digest(packageContent),
  packageLockSha256: digest(lockContent),
}, null, 2));
