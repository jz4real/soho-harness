/** Standalone Skills Settings section. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SkillsSettingsSection, type SkillsSettingsSectionInjected } from './SkillsSettingsSection.tsx'
import { en, zh, type SkillsLocaleKey } from './locales.ts'

export type { SkillsSettingsSectionInjected, SkillsSettingsSectionProps } from './SkillsSettingsSection.tsx'
export type { SkillsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.skills': SkillsLocaleKey
  }
}

const NS = 'settings.skills'

/** Services required by the Settings section and local directory chooser. */
export const inject = ['slots', 'locale', 'remote', 'remote.skillLibrary', 'workspaces']

/** Register Skills as an independent Settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skills: dictionaries')
  const t = ctx.locale.bind(NS) as SkillsSettingsSectionInjected['t']
  const list: SkillsSettingsSectionInjected['list'] = async () => {
    const result = await ctx.remote.skillLibrary.list()
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const inspectFolder: SkillsSettingsSectionInjected['inspectFolder'] = async (path) => {
    const result = await ctx.remote.skillLibrary.inspectFolder(path)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const importFolder: SkillsSettingsSectionInjected['importFolder'] = async (path) => {
    const result = await ctx.remote.skillLibrary.importFolder(path)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const replaceFolder: SkillsSettingsSectionInjected['replaceFolder'] = async (path) => {
    const result = await ctx.remote.skillLibrary.replaceFolder(path)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const setEnabled: SkillsSettingsSectionInjected['setEnabled'] = async (name, enabled) => {
    const result = await ctx.remote.skillLibrary.setEnabled(name, enabled)
    if (!result.ok) throw new Error(result.error.message)
  }
  const remove: SkillsSettingsSectionInjected['remove'] = async (name) => {
    const result = await ctx.remote.skillLibrary.removeSkill(name)
    if (!result.ok) throw new Error(result.error.message)
  }
  const injected = (): SkillsSettingsSectionInjected => ({
    list,
    inspectFolder,
    importFolder,
    replaceFolder,
    setEnabled,
    remove,
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    t,
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills',
    order: 16,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, SkillsSettingsSection))
}
