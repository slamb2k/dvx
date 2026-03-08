import { createClient } from '../client/create-client.js'
import { renderTable } from '../utils/table.js'

interface AuthListOptions {
  output: 'json' | 'table'
}

export async function authList(options: AuthListOptions): Promise<void> {
  const { authManager } = await createClient()
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
    const rows = profiles.map((p) => {
      const marker = p.active ? '*' : ' '
      return [marker, p.name, p.profile.environmentUrl]
    })
    console.log(renderTable(rows, [' ', 'Name', 'URL']))
  }
}
