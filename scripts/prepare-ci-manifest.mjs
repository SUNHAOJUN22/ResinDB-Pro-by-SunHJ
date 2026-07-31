#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const replacementDeclaration = 'src/types/papaparse.d.ts';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const packageLock = JSON.parse(readFileSync(lockPath, 'utf8'));

const declaredDependencyName = '@types/paparse';
const legacyLockedDependencyName = '@types/papaparse';
const expectedDeclaredVersion = '^5.5.2';
const expectedLockedVersion = '5.5.2';
const rootPackage = packageLock.packages?.[''];
if (!rootPackage?.devDependencies || !packageLock.packages) {
  throw new Error('package-lock root dependency metadata is unavailable');
}

const declaredVersion = packageJson.devDependencies?.[declaredDependencyName];
const legacyRootVersion = rootPackage.devDependencies[legacyLockedDependencyName];
const legacyLockedPackage = packageLock.packages[`node_modules/${legacyLockedDependencyName}`];
if (
  declaredVersion !== expectedDeclaredVersion
  || legacyRootVersion !== expectedDeclaredVersion
  || legacyLockedPackage?.version !== expectedLockedVersion
) {
  throw new Error(
    'Unexpected Papa Parse type contract: '
      + `package(${declaredDependencyName})=${declaredVersion}, `
      + `lockRoot(${legacyLockedDependencyName})=${legacyRootVersion}, `
      + `lockPackage=${legacyLockedPackage?.version}`,
  );
}
if (!statSync(replacementDeclaration, { throwIfNoEntry: false })?.isFile()) {
  throw new Error(`Local replacement declaration is missing: ${replacementDeclaration}`);
}

if (!packageJson.devDependencies) throw new Error('package.json devDependencies are unavailable');
delete packageJson.devDependencies[declaredDependencyName];
delete rootPackage.devDependencies[legacyLockedDependencyName];
delete packageLock.packages[`node_modules/${legacyLockedDependencyName}`];

const packageContent = `${JSON.stringify(packageJson, null, 2)}\n`;
const lockContent = `${JSON.stringify(packageLock, null, 2)}\n`;
writeFileSync(packagePath, packageContent);
writeFileSync(lockPath, lockContent);

const digest = (value) => createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  schemaVersion: 'ci-manifest-normalization-1.0.2',
  removedPackageDeclaration: `${declaredDependencyName}@${expectedLockedVersion}`,
  removedLegacyLockEntry: `${legacyLockedDependencyName}@${expectedLockedVersion}`,
  replacementDeclaration,
  replacementDeclarationBytes: statSync(replacementDeclaration).size,
  packageJsonSha256: digest(packageContent),
  packageLockSha256: digest(lockContent),
}, null, 2));
