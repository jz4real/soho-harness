import { cp, lstat, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { parse as parseYaml } from 'yaml'
import type {
  ManagedSkillRoots,
  SkillLibraryConfig,
  SkillLibraryEntry,
  SkillImportPreview,
  SkillLibraryRoots,
  SkillLibrarySource,
} from './types.ts'

export type * from './types.ts'

/** Host-owned Settings API for managed local skills. */
export class SkillLibraryGateway extends TypertRemoteService {
  private readonly userRoot: string
  private readonly disabledRoot: string
  private readonly bundledRoot: string | undefined

  constructor(ctx: Context, config: SkillLibraryConfig = {}) {
    super(ctx, 'skillLibrary')
    const dshHome = resolveDshHome(config.dshHome)
    this.userRoot = join(dshHome, 'skills')
    this.disabledRoot = join(dshHome, 'skills-disabled')
    this.bundledRoot = config.bundledSkillDir ?? process.env.DSH_BUNDLED_SKILL_DIR
  }

  /** List every user-managed and active-profile bundled skill.
   * @returns Settings-facing skill entries.
   */
  @Remote('list')
  list(): Promise<readonly SkillLibraryEntry[]> {
    return listSkillLibrary({
      userRoot: this.userRoot,
      disabledRoot: this.disabledRoot,
      ...(this.bundledRoot === undefined ? {} : { bundledRoot: this.bundledRoot }),
    })
  }

  /** Copy one local folder into the managed skill root.
   * @param sourceDirectory Folder containing one `SKILL.md` bundle.
   * @returns The installed skill entry.
   */
  @Remote('importFolder')
  importFolder(sourceDirectory: string): Promise<SkillLibraryEntry> {
    return importSkillFolder(sourceDirectory, this.userRoot)
  }

  /** Validate a selected folder and report whether importing it would replace a managed skill.
   * @param sourceDirectory Folder containing one `SKILL.md` bundle.
   * @returns Candidate metadata and collision state.
   */
  @Remote('inspectFolder')
  inspectFolder(sourceDirectory: string): Promise<SkillImportPreview> {
    return inspectSkillFolder(sourceDirectory, { userRoot: this.userRoot, disabledRoot: this.disabledRoot })
  }

  /** Replace an existing managed skill with a separately validated local folder.
   * @param sourceDirectory Folder containing one `SKILL.md` bundle.
   * @returns The installed replacement entry.
   */
  @Remote('replaceFolder')
  replaceFolder(sourceDirectory: string): Promise<SkillLibraryEntry> {
    return replaceSkillFolder(sourceDirectory, { userRoot: this.userRoot, disabledRoot: this.disabledRoot })
  }

  /** Switch one managed skill's filesystem discovery state.
   * @param name Kebab-case skill name.
   * @param enabled Whether discovery should be active.
   */
  @Remote('setEnabled')
  setEnabled(name: string, enabled: boolean): Promise<void> {
    return setSkillEnabled(name, { userRoot: this.userRoot, disabledRoot: this.disabledRoot }, enabled)
  }

  /** Remove one managed user skill without touching profile-bundled skills.
   * @param name Kebab-case skill name.
   */
  @Remote('removeSkill')
  removeSkill(name: string): Promise<void> {
    return removeManagedSkill(name, { userRoot: this.userRoot, disabledRoot: this.disabledRoot })
  }
}

export default SkillLibraryGateway

/** Read the two settings-facing roots without changing the agent's skill registry.
 * @param roots Settings read roots.
 * @returns Catalog entries from every configured root.
 */
export async function listSkillLibrary(roots: SkillLibraryRoots): Promise<readonly SkillLibraryEntry[]> {
  const [user, disabled, bundled] = await Promise.all([
    listRoot(roots.userRoot, 'user', 'enabled'),
    roots.disabledRoot === undefined ? [] : listRoot(roots.disabledRoot, 'user', 'disabled'),
    roots.bundledRoot === undefined ? [] : listRoot(roots.bundledRoot, 'built-in', 'read-only'),
  ])
  return [...user, ...disabled, ...bundled]
}

/** Copy one validated local skill directory into the DSH user skill root.
 * @param sourceDirectory Folder containing one `SKILL.md` bundle.
 * @param userRoot Managed enabled-skill root.
 * @returns The installed entry.
 */
export async function importSkillFolder(sourceDirectory: string, userRoot: string): Promise<SkillLibraryEntry> {
  await assertImportDirectoryIsSafe(sourceDirectory)
  const sourcePath = join(sourceDirectory, 'SKILL.md')
  const frontmatter = readFrontmatter(await readFile(sourcePath, 'utf8'))
  if (frontmatter === undefined) throw new TypeError('skill import requires a valid SKILL.md frontmatter block')
  await mkdir(userRoot, { recursive: true })
  const destination = join(userRoot, frontmatter.name)
  try {
    await stat(destination)
    throw new Error(`skill "${frontmatter.name}" already exists`)
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
  }
  const staged = join(userRoot, `.${frontmatter.name}.import-${Date.now()}`)
  try {
    await cp(sourceDirectory, staged, { recursive: true, errorOnExist: true, verbatimSymlinks: true })
    await rename(staged, destination)
  } catch (error) {
    await rm(staged, { recursive: true, force: true })
    throw error
  }
  return { ...frontmatter, source: 'user', status: 'enabled', path: join(destination, 'SKILL.md') }
}

/** Inspect a candidate before a user explicitly imports or replaces a managed skill.
 * @param sourceDirectory Folder containing one `SKILL.md` bundle.
 * @param roots Managed enabled and disabled roots.
 * @returns Candidate metadata and collision state.
 */
export async function inspectSkillFolder(sourceDirectory: string, roots: ManagedSkillRoots): Promise<SkillImportPreview> {
  await assertImportDirectoryIsSafe(sourceDirectory)
  const frontmatter = readFrontmatter(await readFile(join(sourceDirectory, 'SKILL.md'), 'utf8'))
  if (frontmatter === undefined) throw new TypeError('skill import requires a valid SKILL.md frontmatter block')
  const [enabled, disabled] = await Promise.all([
    lstatIfExists(join(roots.userRoot, frontmatter.name)),
    lstatIfExists(join(roots.disabledRoot, frontmatter.name)),
  ])
  if (enabled !== undefined && disabled !== undefined) throw new Error(`skill \"${frontmatter.name}\" exists in both managed roots`)
  return {
    entry: { ...frontmatter, source: 'user', status: 'enabled', path: join(roots.userRoot, frontmatter.name, 'SKILL.md') },
    conflict: enabled !== undefined || disabled !== undefined,
  }
}

/** Replace a managed skill only after the caller has inspected and confirmed the collision.
 * @param sourceDirectory Folder containing one `SKILL.md` bundle.
 * @param roots Managed enabled and disabled roots.
 * @returns The replacement entry.
 */
export async function replaceSkillFolder(sourceDirectory: string, roots: ManagedSkillRoots): Promise<SkillLibraryEntry> {
  const preview = await inspectSkillFolder(sourceDirectory, roots)
  if (preview.conflict) await removeManagedSkill(preview.entry.name, roots)
  return importSkillFolder(sourceDirectory, roots.userRoot)
}

async function assertImportDirectoryIsSafe(directory: string, nested = false): Promise<void> {
  const info = await lstat(directory)
  if (info.isSymbolicLink()) throw new TypeError('symbolic links are not allowed in skill imports')
  if (!info.isDirectory()) throw new TypeError('skill import requires a directory')
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    const entryInfo = await lstat(path)
    if (entryInfo.isSymbolicLink()) throw new TypeError('symbolic links are not allowed in skill imports')
    if (nested && entry.name === 'SKILL.md') throw new TypeError('nested SKILL.md bundles are not allowed')
    if (entryInfo.isDirectory()) await assertImportDirectoryIsSafe(path, true)
  }
}

/** Move a managed skill into or out of the filesystem provider's discovery root.
 * @param name Kebab-case skill name.
 * @param roots Managed enabled and disabled roots.
 * @param enabled Whether discovery should be active.
 */
export async function setSkillEnabled(name: string, roots: ManagedSkillRoots, enabled: boolean): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new TypeError('skill name must be kebab-case')
  const sourceRoot = enabled ? roots.disabledRoot : roots.userRoot
  const destinationRoot = enabled ? roots.userRoot : roots.disabledRoot
  const source = join(sourceRoot, name)
  const destination = join(destinationRoot, name)
  await mkdir(destinationRoot, { recursive: true })
  try {
    await stat(destination)
    throw new Error(`skill "${name}" already exists at destination`)
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
  }
  await rename(source, destination)
}

/** Remove one managed user skill from either its enabled or disabled root.
 * @param name Kebab-case skill name.
 * @param roots Managed enabled and disabled roots.
 */
export async function removeManagedSkill(name: string, roots: ManagedSkillRoots): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new TypeError('skill name must be kebab-case')
  const enabledPath = join(roots.userRoot, name)
  const disabledPath = join(roots.disabledRoot, name)
  const [enabledInfo, disabledInfo] = await Promise.all([
    lstatIfExists(enabledPath),
    lstatIfExists(disabledPath),
  ])
  if (enabledInfo !== undefined && disabledInfo !== undefined) {
    throw new Error(`skill "${name}" exists in both managed roots`)
  }
  const target = enabledInfo === undefined ? disabledInfo === undefined ? undefined : disabledPath : enabledPath
  const targetInfo = enabledInfo ?? disabledInfo
  if (target === undefined || targetInfo === undefined) throw new Error(`skill "${name}" does not exist`)
  if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
    throw new TypeError(`skill "${name}" is not a managed directory`)
  }
  await rm(target, { recursive: true, force: false })
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
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return undefined
  const yaml = match[1]
  if (yaml === undefined) return undefined
  let parsed: unknown
  try {
    parsed = parseYaml(yaml)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const { name, description } = parsed as { name?: unknown; description?: unknown }
  if (typeof name !== 'string' || typeof description !== 'string') return undefined
  const normalizedName = name.trim()
  const normalizedDescription = description.trim()
  if (!normalizedName || !normalizedDescription || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedName)) return undefined
  return { name: normalizedName, description: normalizedDescription }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

async function lstatIfExists(path: string) {
  try {
    return await lstat(path)
  } catch (error: unknown) {
    if (isMissing(error)) return undefined
    throw error
  }
}
