import { AuthManager } from '../auth/auth-manager.js'

interface AuthListOptions {
  output: 'json' | 'table'
}

export async function authList(options: AuthListOptions): Promise<void> {
  const authManager = new AuthManager()
  const profiles = authManager.listProfiles()

  if (profiles.length === 0) {
    console.log('No auth profiles configured.')
    return
  }

  if (options.output === 'json') {
    console.log(JSON.stringify(profiles.map((p) => ({
      name: p.name,
      active: p.active,
      environmentUrl: p.profile.environmentUrl,
    })), null, 2))
  } else {
    const maxName = Math.max(...profiles.map((p) => p.name.length), 4)
    const maxUrl = Math.max(...profiles.map((p) => p.profile.environmentUrl.length), 3)

    console.log(
      '  ' +
      'Name'.padEnd(maxName + 2) +
      'URL',
    )
    console.log('  ' + '-'.repeat(maxName + maxUrl + 4))

    for (const p of profiles) {
      const marker = p.active ? '*' : ' '
      console.log(
        `${marker} ` +
        p.name.padEnd(maxName + 2) +
        p.profile.environmentUrl,
      )
    }
  }
}
