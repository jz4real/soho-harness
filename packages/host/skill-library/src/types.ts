/** Public Settings-facing vocabulary for managed local skills. */

/** Origin of a skill shown in Settings. */
export type SkillLibrarySource = 'user' | 'built-in'

/** Current lifecycle state of a skill shown in Settings. */
export type SkillLibraryStatus = 'enabled' | 'disabled' | 'read-only'

/** One Settings-facing skill summary. */
export interface SkillLibraryEntry {
  readonly name: string
  readonly description: string
  readonly source: SkillLibrarySource
  readonly status: SkillLibraryStatus
  readonly path: string
}

/** Validated import candidate, including whether it would replace a managed skill. */
export interface SkillImportPreview {
  readonly entry: SkillLibraryEntry
  readonly conflict: boolean
}

/** Two read roots exposed to the Settings catalog helper. */
export interface SkillLibraryRoots {
  readonly userRoot: string
  readonly disabledRoot?: string
  readonly bundledRoot?: string
}

/** Managed roots that can be modified by the local Skills controls. */
export interface ManagedSkillRoots {
  readonly userRoot: string
  readonly disabledRoot: string
}

/** Configuration for the host-side Skills Remote service. */
export interface SkillLibraryConfig {
  /** DeepSeek Harness home; defaults to `$DSH_HOME` or `~/.dsh`. */
  readonly dshHome?: string
  /** Read-only runtime skill root; absent means the active profile has none. */
  readonly bundledSkillDir?: string
}
