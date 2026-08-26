import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importSkillFolder, listSkillLibrary } from '../src/index.ts'

describe('listSkillLibrary', () => {
  it('separates a user skill from a bundled skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const userRoot = join(root, 'skills')
    const bundledRoot = join(root, 'bundled')
    await Promise.all([
      writeSkill(userRoot, 'meeting-proposal', 'Use when drafting a meeting proposal.'),
      writeSkill(bundledRoot, 'dsh-badge', 'Use when adding a DSH badge.'),
    ])

    await expect(listSkillLibrary({ userRoot, bundledRoot })).resolves.toEqual([
      expect.objectContaining({ name: 'meeting-proposal', source: 'user', status: 'enabled' }),
      expect.objectContaining({ name: 'dsh-badge', source: 'built-in', status: 'read-only' }),
    ])
  })

  it('copies one valid skill folder into the managed user root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const source = join(root, 'source')
    const userRoot = join(root, 'skills')
    await writeSkill(source, 'meeting-proposal', 'Use when drafting a meeting proposal.')

    await expect(importSkillFolder(join(source, 'meeting-proposal'), userRoot)).resolves.toMatchObject({
      name: 'meeting-proposal',
      source: 'user',
      status: 'enabled',
    })
    await expect(listSkillLibrary({ userRoot, bundledRoot: join(root, 'bundled') })).resolves.toHaveLength(1)
  })
})

async function writeSkill(root: string, name: string, description: string): Promise<void> {
  const directory = join(root, name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\nInstructions.\n`)
}
