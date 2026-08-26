import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '../src/client/index.ts'
import { SkillsSettingsSection } from '../src/client/SkillsSettingsSection.tsx'

describe('ui-settings-skills apply', () => {
  it('registers a separate Skills Settings section without changing Plugins', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    new TestRemote(ctx)
    ctx.provide('remote.skillLibrary', {})
    ctx.provide('workspaces', { pickDirectory: async () => null })
    await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'settings.section': { kind: 'list', scope: 'root' } },
    } as never, () => null)

    await ctx.plugin({ inject: [...inject], apply }).await()

    const entries = slots.entries('settings.section')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      component: SkillsSettingsSection,
      options: { id: 'skills', order: 16 },
    })
    await ctx.fiber.dispose()
  })
})
