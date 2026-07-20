/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { afterEach, expect, test } from 'bun:test'
import { access, cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE_NAME = '@adatechnology/fiscal-provider'
const DIST_DIRECTORY = join(PACKAGE_DIRECTORY, 'dist')
const DIST_BACKUPS: { readonly directory: string; readonly existed: boolean }[] = []
const TEMPORARY_DIRECTORIES: string[] = []

afterEach(async () => {
  await Promise.all(DIST_BACKUPS.splice(0).map(restoreDist))
  await Promise.all(TEMPORARY_DIRECTORIES.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

test('packs JavaScript and public types for a clean Bun consumer', async () => {
  const packageOutputDirectory = await createTemporaryDirectory('ada-fiscal-package-')
  await backupAndRemoveDist()
  const dryRunOutput = await runCommand({
    command: ['npm', 'pack', '--dry-run', '--silent', '--json'],
    cwd: PACKAGE_DIRECTORY,
  })
  const dryRunPackage = parsePackedPackage(dryRunOutput)
  const dryRunPaths = dryRunPackage.files.map((file) => file.path)

  expect(dryRunPaths).toContain('dist/index.js')
  expect(dryRunPaths).toContain('dist/index.d.ts')
  expect(dryRunPaths.some((path) => path.startsWith('src/'))).toBe(false)

  await runCommand({
    command: ['npm', 'pack', '--silent', '--json', '--pack-destination', packageOutputDirectory],
    cwd: PACKAGE_DIRECTORY,
  })
  const packageFileName = await findPackageFileName(packageOutputDirectory)
  const packagePath = join(packageOutputDirectory, packageFileName)
  const archiveContents = await runCommand({
    command: ['tar', '-tzf', packagePath],
    cwd: packageOutputDirectory,
  })

  expect(archiveContents).toContain('package/dist/index.js')
  expect(archiveContents).toContain('package/dist/index.d.ts')
  expect(archiveContents).not.toContain('package/src/')

  const consumerDirectory = await createTemporaryDirectory('ada-fiscal-consumer-')
  await writeConsumerFiles(consumerDirectory)
  await runCommand({
    command: ['bun', 'install', '--no-save', packagePath],
    cwd: consumerDirectory,
  })
  await runCommand({
    command: [join(PACKAGE_DIRECTORY, 'node_modules/.bin/tsc'), '--project', 'tsconfig.json'],
    cwd: consumerDirectory,
  })
  const consumerOutput = await runCommand({
    command: ['bun', 'run', 'verify.ts'],
    cwd: consumerDirectory,
  })

  expect(consumerOutput).toContain('/node_modules/@adatechnology/fiscal-provider/dist/index.js')
  expect(consumerOutput).not.toContain(PACKAGE_DIRECTORY)
}, 30_000)

type RunCommandParams = {
  readonly command: readonly string[]
  readonly cwd: string
}

async function runCommand({ command, cwd }: RunCommandParams): Promise<string> {
  const process = Bun.spawn(command, {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const exitCode = await process.exited
  const stdout = await new Response(process.stdout).text()
  const stderr = await new Response(process.stderr).text()

  expect(exitCode, `${command.join(' ')} failed:\n${stderr || stdout}`).toBe(0)
  return stdout
}

type PackedPackage = {
  readonly filename: string
  readonly files: readonly { readonly path: string }[]
}

function parsePackedPackage(output: string): PackedPackage {
  const jsonStart = output.lastIndexOf('\n[\n  {\n    "id":')
  const jsonOutput = jsonStart >= 0 ? output.slice(jsonStart + 1) : output.trimStart()
  const parsedOutput: unknown = JSON.parse(jsonOutput)
  if (!Array.isArray(parsedOutput) || parsedOutput.length !== 1) {
    throw new TypeError('Expected exactly one package from npm pack')
  }

  const packageEntry: unknown = parsedOutput[0]
  if (!isPackedPackage(packageEntry)) {
    throw new TypeError('Expected npm pack metadata with a filename and files')
  }
  return packageEntry
}

function isPackedPackage(value: unknown): value is PackedPackage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record['filename'] === 'string' && Array.isArray(record['files']) && record['files'].every(isPackedFile)
}

function isPackedFile(value: unknown): value is { readonly path: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)['path'] === 'string'
  )
}

async function createTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  TEMPORARY_DIRECTORIES.push(directory)
  return directory
}

async function backupAndRemoveDist(): Promise<void> {
  const existed = await pathExists(DIST_DIRECTORY)
  const directory = await createTemporaryDirectory('ada-fiscal-dist-backup-')
  if (existed) {
    await cp(DIST_DIRECTORY, join(directory, 'dist'), { recursive: true })
  }
  DIST_BACKUPS.push({ directory, existed })
  await rm(DIST_DIRECTORY, { force: true, recursive: true })
}

async function restoreDist(backup: { readonly directory: string; readonly existed: boolean }): Promise<void> {
  await rm(DIST_DIRECTORY, { force: true, recursive: true })
  if (backup.existed) {
    await cp(join(backup.directory, 'dist'), DIST_DIRECTORY, { recursive: true })
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function findPackageFileName(directory: string): Promise<string> {
  const packageFiles = (await readdir(directory)).filter((fileName) => fileName.endsWith('.tgz'))
  if (packageFiles.length !== 1 || !packageFiles[0]) {
    throw new Error('Expected exactly one fiscal-provider tarball')
  }
  return packageFiles[0]
}

async function writeConsumerFiles(consumerDirectory: string): Promise<void> {
  await Bun.write(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      name: 'fiscal-provider-clean-consumer',
      private: true,
      type: 'module',
    }),
  )
  await Bun.write(
    join(consumerDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        strict: true,
        target: 'ESNext',
        types: [],
      },
      include: ['verify.ts'],
    }),
  )
  await Bun.write(
    join(consumerDirectory, 'verify.ts'),
    [
      `import { importarNfeXml, NFE_XML_IMPORT_ERROR_CODE } from '${PACKAGE_NAME}'`,
      `import type { ImportedNfeXml } from '${PACKAGE_NAME}'`,
      '',
      'const importer: (xml: string) => ImportedNfeXml = importarNfeXml',
      "if (typeof importer !== 'function') throw new Error('missing importer')",
      "if (!NFE_XML_IMPORT_ERROR_CODE.invalidAccessKey) throw new Error('missing error codes')",
      `console.log(import.meta.resolve('${PACKAGE_NAME}'))`,
    ].join('\n'),
  )
}
