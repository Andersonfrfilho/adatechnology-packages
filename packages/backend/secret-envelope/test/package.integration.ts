/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectories: string[] = []

async function runCommand(command: string[], workingDirectory: string): Promise<string> {
  const process = Bun.spawn(command, {
    cwd: workingDirectory,
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const result = await process.exited
  const stdout = await new Response(process.stdout).text()
  const stderr = await new Response(process.stderr).text()

  expect(result, `${command.join(' ')} failed: ${stderr}`).toBe(0)
  return stdout
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'secret-envelope-package-'))
  temporaryDirectories.push(directory)
  return directory
}

async function findPackageFileName(directory: string): Promise<string> {
  const packageFiles = (await readdir(directory)).filter((fileName) => fileName.endsWith('.tgz'))
  if (packageFiles.length !== 1) throw new Error('expected exactly one package tarball')
  const [packageFileName] = packageFiles
  if (!packageFileName) throw new Error('package tarball is missing')
  return packageFileName
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

test('packs a clean ESM package consumable by Bun without runtime dependencies', async () => {
  const packageOutputDirectory = await createTemporaryDirectory()
  await runCommand(
    ['npm', 'pack', '--silent', '--json', '--pack-destination', packageOutputDirectory],
    packageDirectory,
  )
  const packageFileName = await findPackageFileName(packageOutputDirectory)
  const packagePath = join(packageOutputDirectory, packageFileName)
  const secondPackageOutputDirectory = await createTemporaryDirectory()
  await runCommand(
    ['npm', 'pack', '--silent', '--json', '--pack-destination', secondPackageOutputDirectory],
    packageDirectory,
  )
  expect(await findPackageFileName(secondPackageOutputDirectory)).toBe(packageFileName)
  const firstTarball = await readFile(packagePath)
  const secondTarball = await readFile(join(secondPackageOutputDirectory, packageFileName))
  const archiveContents = await runCommand(['tar', '-tzf', packagePath], packageOutputDirectory)

  expect(firstTarball).toEqual(secondTarball)
  expect(archiveContents.trim().split('\n').sort()).toEqual([
    'package/README.md',
    'package/dist/index.d.ts',
    'package/dist/index.js',
    'package/package.json',
  ])

  const consumerDirectory = await createTemporaryDirectory()
  await Bun.write(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'secret-envelope-consumer', private: true, type: 'module' }),
  )
  await Bun.write(
    join(consumerDirectory, 'verify.ts'),
    [
      "import { createSecretEnvelopeProvider } from '@adatechnology/secret-envelope'",
      "import type { SecretEnvelopeV1 } from '@adatechnology/secret-envelope'",
      '',
      'const envelope: SecretEnvelopeV1 | undefined = undefined',
      "const provider = createSecretEnvelopeProvider({ activeKeyId: 'key-v1', keys: { 'key-v1': new Uint8Array(32) } })",
      "if (typeof provider.encrypt !== 'function' || envelope !== undefined) throw new Error('invalid package exports')",
    ].join('\n'),
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

  await runCommand(['bun', 'install', '--no-save', packagePath], consumerDirectory)
  await runCommand([join(packageDirectory, 'node_modules/.bin/tsc'), '--project', 'tsconfig.json'], consumerDirectory)
  await runCommand(['bun', 'run', 'verify.ts'], consumerDirectory)

  const installedPackageJson = await readFile(
    join(consumerDirectory, 'node_modules/@adatechnology/secret-envelope/package.json'),
    'utf8',
  )
  const installedModule = await readFile(
    join(consumerDirectory, 'node_modules/@adatechnology/secret-envelope/dist/index.js'),
    'utf8',
  )
  expect(JSON.parse(installedPackageJson).dependencies).toBeUndefined()
  expect(installedModule).not.toContain('@adatechnology/logger')
})
