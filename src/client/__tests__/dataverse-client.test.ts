import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataverseClient } from '../dataverse-client.js'
import { AuthManager } from '../../auth/auth-manager.js'

vi.mock('../../auth/auth-manager.js')

function createMockAuthManager(): AuthManager {
  const mock = new AuthManager()
  vi.spyOn(mock, 'getActiveProfile').mockReturnValue({
    name: 'test',
    type: 'service-principal',
    environmentUrl: 'https://org.crm.dynamics.com',
    tenantId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
  })
  vi.spyOn(mock, 'getToken').mockResolvedValue('fake-token')
  return mock
}

describe('DataverseClient', () => {
  let client: DataverseClient
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const authManager = createMockAuthManager()
    client = new DataverseClient(authManager)
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  describe('listEntities', () => {
    it('returns mapped entity list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              LogicalName: 'account',
              DisplayName: { UserLocalizedLabel: { Label: 'Account' } },
              EntitySetName: 'accounts',
              PrimaryIdAttribute: 'accountid',
              PrimaryNameAttribute: 'name',
            },
          ],
        }),
      })

      const result = await client.listEntities()
      expect(result).toEqual([
        { logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' },
      ])
    })
  })

  describe('getRecord', () => {
    it('fetches a single record by id', async () => {
      const schemaResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          LogicalName: 'account',
          DisplayName: { UserLocalizedLabel: { Label: 'Account' } },
          EntitySetName: 'accounts',
          PrimaryIdAttribute: 'accountid',
          PrimaryNameAttribute: 'name',
          Attributes: [],
        }),
      }
      const recordResponse = {
        ok: true,
        status: 200,
        json: async () => ({ accountid: '00000000-0000-0000-0000-000000000003', name: 'Test' }),
      }

      mockFetch.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce(recordResponse)

      const result = await client.getRecord('account', '00000000-0000-0000-0000-000000000003')
      expect(result).toEqual({ accountid: '00000000-0000-0000-0000-000000000003', name: 'Test' })
    })
  })

  describe('query', () => {
    it('returns records from OData query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            { accountid: '1', name: 'Acme' },
            { accountid: '2', name: 'Contoso' },
          ],
        }),
      })

      const result = await client.query('accounts', '$filter=name ne null')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ accountid: '1', name: 'Acme' })
    })
  })
})
