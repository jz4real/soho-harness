import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SkillImportPreview, SkillLibraryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { en } from './locales.ts'
import css from './SkillsSettingsSection.module.css'

/** Host operations and picker capability injected by the Settings registration. */
export interface SkillsSettingsSectionInjected {
  list: () => Promise<readonly SkillLibraryEntry[]>
  inspectFolder: (path: string) => Promise<SkillImportPreview>
  importFolder: (path: string) => Promise<SkillLibraryEntry>
  replaceFolder: (path: string) => Promise<SkillLibraryEntry>
  setEnabled: (name: string, enabled: boolean) => Promise<void>
  remove: (name: string) => Promise<void>
  pickDirectory: () => Promise<string | null>
  t: (key: keyof typeof en) => string
}

/** Props delivered by the Settings section slot. */
export type SkillsSettingsSectionProps = Partial<InjectFace<SkillsSettingsSectionInjected>>

type Tab = 'mine' | 'built-in'
type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly entries: readonly SkillLibraryEntry[] }

const STATUS_KEY = {
  enabled: 'enabled',
  disabled: 'disabled',
  'read-only': 'readOnly',
} as const satisfies Record<SkillLibraryEntry['status'], keyof typeof import('./locales.ts').en>

/** Render the standalone Skills settings surface. */
export function SkillsSettingsSection(props: SkillsSettingsSectionProps): ReactNode {
  const [tab, setTab] = useState<Tab>('mine')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | undefined>()
  const [preview, setPreview] = useState<{ readonly path: string; readonly value: SkillImportPreview } | undefined>()
  const {
    list, inspectFolder, importFolder, replaceFolder, setEnabled, remove, pickDirectory, t,
  } = props as InjectFace<SkillsSettingsSectionInjected>

  const reload = async (): Promise<void> => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', entries: await list() })
    } catch {
      setState({ kind: 'error' })
    }
  }

  useEffect(() => { void reload() }, [list])

  const entries = useMemo(() => {
    if (state.kind !== 'ready') return []
    const source = tab === 'mine' ? 'user' : 'built-in'
    const normalized = query.trim().toLocaleLowerCase()
    return state.entries.filter(entry => entry.source === source && (
      normalized.length === 0 || entry.name.toLocaleLowerCase().includes(normalized)
        || entry.description.toLocaleLowerCase().includes(normalized)
    ))
  }, [query, state, tab])

  const importFromPicker = async (): Promise<void> => {
    setNotice(undefined)
    setBusy(true)
    try {
      const path = await pickDirectory()
      if (path === null) return
      setPreview({ path, value: await inspectFolder(path) })
    } catch {
      setState({ kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const confirmImport = async (): Promise<void> => {
    if (preview === undefined) return
    setBusy(true)
    setNotice(undefined)
    try {
      const entry = preview.value.conflict
        ? await replaceFolder(preview.path)
        : await importFolder(preview.path)
      setNotice(t('importSuccess').replace('{name}', entry.name))
      setPreview(undefined)
      await reload()
    } catch {
      setState({ kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const changeEnabled = async (entry: SkillLibraryEntry, enabled: boolean): Promise<void> => {
    setBusy(true)
    setNotice(undefined)
    try {
      await setEnabled(entry.name, enabled)
      await reload()
    } catch {
      setState({ kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const deleteEntry = async (entry: SkillLibraryEntry): Promise<void> => {
    setBusy(true)
    setNotice(undefined)
    try {
      await remove(entry.name)
      await reload()
    } catch {
      setState({ kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={css.section} aria-busy={busy || state.kind === 'loading'}>
      <header className={css.header}>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('description')}</p>
        </div>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={() => { void importFromPicker() }}>
          {busy ? t('importing') : t('import')}
        </button>
      </header>
      <div className={css.tabs} role="tablist" aria-label={t('title')}>
        <button role="tab" type="button" aria-selected={tab === 'mine'} onClick={() => { setTab('mine') }}>{t('mine')}</button>
        <button role="tab" type="button" aria-selected={tab === 'built-in'} onClick={() => { setTab('built-in') }}>{t('builtIn')}</button>
      </div>
      {notice === undefined ? null : <p className={css.notice}>{notice}</p>}
      {preview === undefined ? null : (
        <aside className={css.preview} aria-label={t('importPreview')}>
          <strong>/{preview.value.entry.name}</strong>
          <p>{preview.value.entry.description}</p>
          <p>{preview.value.conflict ? t('replaceWarning') : t('importReady')}</p>
          <div className={css.actions}>
            <button type="button" disabled={busy} onClick={() => { void confirmImport() }}>
              {preview.value.conflict ? t('replace') : t('confirmImport')}
            </button>
            <button type="button" disabled={busy} onClick={() => { setPreview(undefined) }}>{t('cancel')}</button>
          </div>
        </aside>
      )}
      {state.kind === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.kind === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={() => { void reload() }}>{t('retry')}</button>
        </div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <input
            className={css.search}
            type="search"
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value) }}
          />
          {entries.length === 0 ? <p className={css.status}>{query.trim().length > 0 ? t('noMatch') : tab === 'mine' ? t('noMine') : t('noBuiltIn')}</p> : null}
          <ul className={css.cards}>
            {entries.map(entry => (
              <li key={`${entry.source}-${entry.status}-${entry.name}`} className={css.card}>
                <div className={css.cardHeader}>
                  <strong>/{entry.name}</strong>
                  <span data-status={entry.status}>{t(STATUS_KEY[entry.status])}</span>
                </div>
                <p>{entry.description}</p>
                <code title={entry.path}>{entry.path}</code>
                {entry.source === 'user' ? (
                  <div className={css.actions}>
                    <button type="button" disabled={busy} onClick={() => { void changeEnabled(entry, entry.status === 'disabled') }}>
                      {entry.status === 'disabled' ? t('enable') : t('disable')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => { void deleteEntry(entry) }}>{t('remove')}</button>
                  </div>
                ) : null}
                <p className={css.invokeHint}>{t('invokeHint').replace('{name}', entry.name)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
