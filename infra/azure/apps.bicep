targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Short application name used in resource names.')
param appName string = 'denimfit'

@description('Container Apps environment name created by core.bicep.')
param containerAppsEnvironmentName string

@description('Azure Container Registry login server.')
param acrLoginServer string

@description('User-assigned identity name with AcrPull on the registry.')
param acrPullIdentityName string

@description('Fully qualified API container image.')
param apiImage string

@description('Fully qualified web container image.')
param webImage string

@description('Fully qualified WireMock container image.')
param wiremockImage string

@description('PostgreSQL host name.')
param postgresHost string

@description('PostgreSQL administrator username.')
param postgresAdminLogin string = 'denim'

@secure()
@description('PostgreSQL administrator password.')
param postgresAdminPassword string

@description('PostgreSQL database name.')
param postgresDatabaseName string = 'denim_fit'

@secure()
@description('Optional Anthropic API key for recommendation re-ranking.')
param anthropicApiKey string = ''

@secure()
@description('Optional Anthropic-compatible base URL.')
param anthropicBaseUrl string = ''

@description('Recommendation model identifier.')
param recommenderModel string = 'claude-opus-4-8'

var apiAppName = 'ca-${appName}-api'
var webAppName = 'ca-${appName}-web'
var wiremockAppName = 'ca-${appName}-wiremock'

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-07-01' existing = {
  name: containerAppsEnvironmentName
}

resource acrPullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: acrPullIdentityName
}

resource wiremock 'Microsoft.App/containerApps@2025-07-01' = {
  name: wiremockAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${acrPullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'http'
      }
      registries: [
        {
          server: acrLoginServer
          identity: acrPullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'wiremock'
          image: wiremockImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2025-07-01' = {
  name: apiAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${acrPullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 4000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: acrPullIdentity.id
        }
      ]
      secrets: [
        {
          name: 'postgres-password'
          value: postgresAdminPassword
        }
        {
          name: 'anthropic-api-key'
          value: anthropicApiKey
        }
        {
          name: 'anthropic-base-url'
          value: anthropicBaseUrl
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          env: [
            {
              name: 'API_PORT'
              value: '4000'
            }
            {
              name: 'PGHOST'
              value: postgresHost
            }
            {
              name: 'PGPORT'
              value: '5432'
            }
            {
              name: 'PGDATABASE'
              value: postgresDatabaseName
            }
            {
              name: 'PGUSER'
              value: postgresAdminLogin
            }
            {
              name: 'PGPASSWORD'
              secretRef: 'postgres-password'
            }
            {
              name: 'PGSSLMODE'
              value: 'require'
            }
            {
              name: 'THIRD_PARTY_BASE_URL'
              value: 'http://${wiremock.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'ANTHROPIC_API_KEY'
              secretRef: 'anthropic-api-key'
            }
            {
              name: 'ANTHROPIC_BASE_URL'
              secretRef: 'anthropic-base-url'
            }
            {
              name: 'RECOMMENDER_MODEL'
              value: recommenderModel
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

resource web 'Microsoft.App/containerApps@2025-07-01' = {
  name: webAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${acrPullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 5173
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: acrPullIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          env: [
            {
              name: 'VITE_API_BASE_URL'
              value: 'https://${api.properties.configuration.ingress.fqdn}'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
output wiremockInternalUrl string = 'http://${wiremock.properties.configuration.ingress.fqdn}'
