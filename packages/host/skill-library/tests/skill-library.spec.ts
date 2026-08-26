import { access, mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it } from 'vitest'
import SkillLibraryGateway, {
  importSkillFolder, inspectSkillFolder, listSkillLibrary, removeManagedSkill, replaceSkillFolder, setSkillEnabled,
} from '../src/index.ts'

describe('listSkillLibrary', () => {
  it('publishes the named skill-library Remote methods for the settings client', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const ctx = new Context()
    await ctx.plugin(SkillLibraryGateway, { dshHome: root })
    const gateway = ctx.get('skillLibrary') as SkillLibraryGateway

    expect(remoteMethods(gateway)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'importFolder', invocation: { kind: 'direct' } },
      { method: 'inspectFolder', invocation: { kind: 'direct' } },
      { method: 'replaceFolder', invocation: { kind: 'direct' } },
      { method: 'setEnabled', invocation: { kind: 'direct' } },
      { method: 'removeSkill', invocation: { kind: 'direct' } },
    ])
    await ctx.fiber.dispose()
  })

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

  it('inspects a collision before replacing the managed skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const source = join(root, 'source')
    const userRoot = join(root, 'skills')
    const disabledRoot = join(root, 'skills-disabled')
    await Promise.all([
      writeSkill(source, 'meeting-proposal', 'New description.'),
      writeSkill(userRoot, 'meeting-proposal', 'Old description.'),
    ])

    await expect(inspectSkillFolder(join(source, 'meeting-proposal'), { userRoot, disabledRoot })).resolves.toMatchObject({
      conflict: true,
      entry: { name: 'meeting-proposal', description: 'New description.' },
    })
    await replaceSkillFolder(join(source, 'meeting-proposal'), { userRoot, disabledRoot })
    await expect(listSkillLibrary({ userRoot })).resolves.toEqual([
      expect.objectContaining({ name: 'meeting-proposal', description: 'New description.' }),
    ])
  })

  it('rejects an import folder that contains a symbolic link without creating a managed copy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const source = join(root, 'source')
    const userRoot = join(root, 'skills')
    const bundle = join(source, 'meeting-proposal')
    const outside = join(root, 'outside.txt')
    await writeSkill(source, 'meeting-proposal', 'Use when drafting a meeting proposal.')
    await writeFile(outside, 'must not be imported')
    await symlink(outside, join(bundle, 'linked-resource'))

    await expect(importSkillFolder(bundle, userRoot)).rejects.toThrow('symbolic links are not allowed')
    await expect(access(join(userRoot, 'meeting-proposal'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects malformed YAML frontmatter instead of installing a partially parsed skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const source = join(root, 'meeting-proposal')
    const userRoot = join(root, 'skills')
    await mkdir(source, { recursive: true })
    await writeFile(join(source, 'SKILL.md'), '---\nname: meeting-proposal\ndescription: "unterminated\n---\n\nInstructions.\n')

    await expect(importSkillFolder(source, userRoot)).rejects.toThrow('valid SKILL.md frontmatter')
    await expect(access(join(userRoot, 'meeting-proposal'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a folder that embeds another SKILL.md bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const source = join(root, 'source')
    const userRoot = join(root, 'skills')
    const bundle = join(source, 'meeting-proposal')
    await writeSkill(source, 'meeting-proposal', 'Use when drafting a meeting proposal.')
    await writeSkill(bundle, 'nested-skill', 'This must not become a second bundle.')

    await expect(importSkillFolder(bundle, userRoot)).rejects.toThrow('nested SKILL.md bundles are not allowed')
    await expect(access(join(userRoot, 'meeting-proposal'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('moves a disabled skill out of the DSH discovery root and restores it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const userRoot = join(root, 'skills')
    const disabledRoot = join(root, 'skills-disabled')
    await writeSkill(userRoot, 'meeting-proposal', 'Use when drafting a meeting proposal.')

    await setSkillEnabled('meeting-proposal', { userRoot, disabledRoot }, false)
    await expect(listSkillLibrary({ userRoot, bundledRoot: join(root, 'bundled') })).resolves.toEqual([])
    await setSkillEnabled('meeting-proposal', { userRoot, disabledRoot }, true)
    await expect(listSkillLibrary({ userRoot, bundledRoot: join(root, 'bundled') })).resolves.toHaveLength(1)
  })

  it('removes only the managed disabled copy and leaves a bundled skill untouched', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-library-'))
    const userRoot = join(root, 'skills')
    const disabledRoot = join(root, 'skills-disabled')
    const bundledRoot = join(root, 'bundled')
    await Promise.all([
      writeSkill(userRoot, 'meeting-proposal', 'Use when drafting a meeting proposal.'),
      writeSkill(bundledRoot, 'dsh-badge', 'Use when adding a DSH badge.'),
    ])
    await setSkillEnabled('meeting-proposal', { userRoot, disabledRoot }, false)

    await removeManagedSkill('meeting-proposal', { userRoot, disabledRoot })

    await expect(access(join(disabledRoot, 'meeting-proposal'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(listSkillLibrary({ userRoot, bundledRoot })).resolves.toEqual([
      expect.objectContaining({ name: 'dsh-badge', source: 'built-in', status: 'read-only' }),
    ])
  })
})

async function writeSkill(root: string, name: string, description: string): Promise<void> {
  const directory = join(root, name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\nInstructions.\n`)
}
