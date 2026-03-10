import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataverseClient } from '../dataverse-client.js'
import { AuthManager } from '../../auth/auth-manager.js'

vi.mock('../../auth/auth-manager.js')

vi.mock('../../utils/cli.js', async () => {
  const { createCliMock } = await import('../../__tests__/helpers/cli-mock.js')
  return createCliMock()
})

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

  describe('createRecord', () => {
    it('posts data and returns GUID from OData-EntityId header', async () => {
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
      const createResponse = {
        ok: true,
        status: 204,
        headers: new Map([['OData-EntityId', 'https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000099)']]),
        json: async () => ({}),
      }
      // Mock headers.get for the create response
      createResponse.headers.get = (key: string) => createResponse.headers.get(key)
      const headersObj = {
        get: (key: string) => key === 'OData-EntityId' ? 'https://org.crm.dynamics.com/api/data/v9.2/accounts(00000000-0000-0000-0000-000000000099)' : null,
      }

      mockFetch
        .mockResolvedValueOnce(schemaResponse)
        .mockResolvedValueOnce({ ok: true, status: 204, headers: headersObj, json: async () => ({}) })

      const id = await client.createRecord('account', { name: 'Test' })
      expect(id).toBe('00000000-0000-0000-0000-000000000099')
    })
  })

  describe('updateRecord', () => {
    it('patches data for existing record', async () => {
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
      const patchResponse = { ok: true, status: 204, json: async () => ({}) }

      mockFetch.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce(patchResponse)

      await expect(client.updateRecord('account', '00000000-0000-0000-0000-000000000001', { name: 'Updated' }))
        .resolves.toBeUndefined()
    })
  })

  describe('deleteRecord', () => {
    it('sends DELETE request for record', async () => {
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
      const deleteResponse = { ok: true, status: 204, json: async () => ({}) }

      mockFetch.mockResolvedValueOnce(schemaResponse).mockResolvedValueOnce(deleteResponse)

      await expect(client.deleteRecord('account', '00000000-0000-0000-0000-000000000001'))
        .resolves.toBeUndefined()
    })
  })

  describe('dryRun mode', () => {
    it('does not make HTTP calls in dryRun mode', async () => {
      const authManager = createMockAuthManager()
      const dryClient = new DataverseClient(authManager, undefined, { dryRun: true })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // Schema fetch still needs to happen for entitySetName
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
      mockFetch.mockResolvedValueOnce(schemaResponse)

      const id = await dryClient.createRecord('account', { name: 'Test' })
      expect(id).toBe('dry-run')
      // Only schema fetch should have been called, not the create POST
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
