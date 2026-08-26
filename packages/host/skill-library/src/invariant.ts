/** Package-owned invariant companion. @module @deepseek-ai/dsh-host-skill-library/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-skill-library'

/** Cordis companion plugin name. */
export const name = 'host-skill-library-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Filesystem state is validated at each mutation boundary. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
