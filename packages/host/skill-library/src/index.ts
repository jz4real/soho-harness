import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SkillLibrarySource = 'user' | 'built-in'

export interface SkillLibraryEntry {
  readonly name: string
  readonly description: string
  readonly source: SkillLibrarySource
  readonly status: 'enabled' | 'read-only'
  readonly path: string
}

export interface SkillLibraryRoots {
  readonly userRoot: string
  readonly bundledRoot: string
}

/** Read the two settings-facing roots without changing the agent's skill registry. */
export async function listSkillLibrary(roots: SkillLibraryRoots): Promise<readonly SkillLibraryEntry[]> {
  const [user, bundled] = await Promise.all([
    listRoot(roots.userRoot, 'user', 'enabled'),
    listRoot(roots.bundledRoot, 'built-in', 'read-only'),
  ])
  return [...user, ...bundled]
}

async function listRoot(
  root: string,
  source: SkillLibrarySource,
  status: SkillLibraryEntry['status'],
): Promise<SkillLibraryEntry[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error: unknown) {
    if (isMissing(error)) return []
    throw error
  }
  const listed = await Promise.all(entries.filter(entry => entry.isDirectory()).map(async (entry) => {
    const path = join(root, entry.name, 'SKILL.md')
    try {
      const text = await readFile(path, 'utf8')
      const frontmatter = readFrontmatter(text)
      return frontmatter === undefined ? undefined : { ...frontmatter, source, status, path }
    } catch (error: unknown) {
      if (isMissing(error)) return undefined
      throw error
    }
  }))
  return listed.filter((entry): entry is SkillLibraryEntry => entry !== undefined)
}

function readFrontmatter(text: string): Pick<SkillLibraryEntry, 'name' | 'description'> | undefined {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return undefined
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return undefined
  return { name, description }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
