@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name (dev or prod)')
@allowed(['dev', 'prod'])
param envName string

@description('Full image reference including tag')
param imageName string

@description('ACR login server (e.g. myregistry.azurecr.io)')
param registryServer string

@description('Dataverse environment URL')
@secure()
param dataverseUrl string

@description('Dataverse client ID')
@secure()
param dataverseClientId string

@description('Dataverse client secret')
@secure()
param dataverseClientSecret string

@description('Dataverse tenant ID')
@secure()
param dataverseTenantId string

@description('Comma-separated entity scope for MCP server')
param mcpEntities string = ''

var appName = 'ca-dvx-${envName}'
var envResourceName = 'cae-dvx-${envName}'
var isProduction = envName == 'prod'

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envResourceName
  location: location
  properties: {
    zoneRedundant: isProduction
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          server: registryServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'dataverse-url', value: dataverseUrl }
        { name: 'dataverse-client-id', value: dataverseClientId }
        { name: 'dataverse-client-secret', value: dataverseClientSecret }
        { name: 'dataverse-tenant-id', value: dataverseTenantId }
      ]
    }
    template: {
      containers: [
        {
          name: 'dvx'
          image: imageName
          resources: {
            cpu: json(isProduction ? '1.0' : '0.5')
            memory: isProduction ? '2Gi' : '1Gi'
          }
          env: [
            { name: 'DATAVERSE_URL', secretRef: 'dataverse-url' }
            { name: 'DATAVERSE_CLIENT_ID', secretRef: 'dataverse-client-id' }
            { name: 'DATAVERSE_CLIENT_SECRET', secretRef: 'dataverse-client-secret' }
            { name: 'DATAVERSE_TENANT_ID', secretRef: 'dataverse-tenant-id' }
            { name: 'DVX_SCHEMA_CACHE_TTL_MS', value: isProduction ? '600000' : '300000' }
            { name: 'DVX_MAX_ROWS', value: '5000' }
            { name: 'DVX_MCP_ENTITIES', value: mcpEntities }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: isProduction ? 2 : 1
        maxReplicas: isProduction ? 10 : 3
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output appName string = containerApp.name
