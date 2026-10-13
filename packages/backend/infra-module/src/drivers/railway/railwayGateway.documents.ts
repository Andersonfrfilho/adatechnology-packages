/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const RAILWAY_OPERATION = {
  INVENTORY: 'listInventory',
  ENVIRONMENT_SERVICES: 'getEnvironmentServices',
  STOP: 'deploymentStop',
  REMOVE: 'deploymentRemove',
  RESTART: 'deploymentRestart',
  REDEPLOY: 'serviceInstanceRedeploy',
  BILLING_CYCLE: 'getBillingCycle',
  USAGE: 'getUsage',
  ESTIMATED_USAGE: 'getEstimatedUsage',
  VERIFY_WORKSPACE: 'verifyWorkspace',
} as const

export const INVENTORY_QUERY = `query ListInventory($workspaceId: String!) {
  projects(workspaceId: $workspaceId) {
    edges { node {
      id name
      environments { edges { node {
        id name
        serviceInstances { edges { node {
          serviceId serviceName
          source { image repo }
          latestDeployment { id status deploymentStopped instances { status } }
          activeDeployments { id deploymentStopped }
        } } }
      } } }
    } }
  }
}`

export const ENVIRONMENT_SERVICES_QUERY = `query EnvironmentServices($id: String!) {
  environment(id: $id) {
    serviceInstances { edges { node {
      serviceId serviceName
      source { image repo }
      latestDeployment { id status deploymentStopped instances { status } }
      activeDeployments { id deploymentStopped }
    } } }
  }
}`

export const STOP_MUTATION = 'mutation StopDeployment($id: String!) { deploymentStop(id: $id) }'
export const REMOVE_MUTATION = 'mutation RemoveDeployment($id: String!) { deploymentRemove(id: $id) }'
export const RESTART_MUTATION = 'mutation RestartDeployment($id: String!) { deploymentRestart(id: $id) }'
export const REDEPLOY_MUTATION = `mutation RedeployService($environmentId: String!, $serviceId: String!) {
  serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
}`

export const WORKSPACE_QUERY =
  'query VerifyWorkspace($workspaceId: String!) { workspace(workspaceId: $workspaceId) { id } }'

export const BILLING_CYCLE_QUERY = `query BillingCycle($workspaceId: String!) {
  workspace(workspaceId: $workspaceId) { customer { currentUsage billingPeriod { start end } } }
}`

export const USAGE_QUERY = `query Usage($workspaceId: String!, $startDate: DateTime!, $endDate: DateTime!) {
  usage(
    workspaceId: $workspaceId, startDate: $startDate, endDate: $endDate,
    measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB],
    groupBy: [PROJECT_ID, ENVIRONMENT_ID]
  ) { measurement value tags { projectId environmentId } }
}`

export const ESTIMATED_USAGE_QUERY = `query EstimatedUsage($workspaceId: String!) {
  estimatedUsage(workspaceId: $workspaceId, measurements: [CPU_USAGE, MEMORY_USAGE_GB]) {
    measurement estimatedValue projectId
  }
}`
