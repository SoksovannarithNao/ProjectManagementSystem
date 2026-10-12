import { describe, expect, it } from 'vitest'
import {
  EMPTY_PERMISSIONS,
  canAnywhere,
  canApproveTask,
  canInProject,
  canSystem,
  isOwnerOrAdministrator,
  projectIdsWhere,
  projectRoleOf,
} from './permissions'

// What GET /api/users/me/permissions returns, for a few kinds of caller.
const administrator = { role: 'ADMINISTRATOR', administrator: true, system: [], projects: [] }
const manager = {
  role: 'PROJECT_MANAGER',
  administrator: false,
  system: ['PROJECT:CREATE', 'REPORT:GENERATE_REPORTS'],
  projects: [
    { projectId: 1, projectRole: 'OWNER', roleName: 'OWNER', grants: ['TASK:CREATE', 'TASK:APPROVE', 'TASK:EDIT'] },
    { projectId: 2, projectRole: 'VIEWER', roleName: 'VIEWER', grants: ['TASK:VIEW'] },
  ],
}
const member = {
  role: 'USER',
  administrator: false,
  system: [],
  projects: [{ projectId: 1, projectRole: 'MEMBER', roleName: 'MEMBER', grants: ['TASK:VIEW', 'TASK_STATUS:EDIT'] }],
}
const leader = {
  role: 'USER',
  administrator: false,
  system: [],
  projects: [{ projectId: 1, projectRole: 'ADMIN', roleName: 'ADMIN', grants: ['TASK:APPROVE', 'TASK:ASSIGN'] }],
}

describe('canInProject', () => {
  it('lets an administrator do anything', () => {
    expect(canInProject(administrator, 'TASK', 'DELETE', 99)).toBe(true)
  })

  it('uses the grants of the role held in that project only', () => {
    expect(canInProject(manager, 'TASK', 'CREATE', 1)).toBe(true)
    expect(canInProject(manager, 'TASK', 'CREATE', 2)).toBe(false) // a viewer of project 2
    expect(canInProject(manager, 'TASK', 'CREATE', 3)).toBe(false) // not a member at all
  })

  it('accepts a project id given as text', () => {
    expect(canInProject(manager, 'TASK', 'EDIT', '1')).toBe(true)
  })

  it('counts a system-wide grant everywhere', () => {
    expect(canInProject(manager, 'REPORT', 'GENERATE_REPORTS', 3)).toBe(true)
  })

  it('refuses without a project id or without permissions', () => {
    expect(canInProject(member, 'TASK', 'EDIT', undefined)).toBe(false)
    expect(canInProject(null, 'TASK', 'VIEW', 1)).toBe(false)
    expect(canInProject(EMPTY_PERMISSIONS, 'TASK', 'VIEW', 1)).toBe(false)
  })
})

describe('canSystem', () => {
  it('reads only the system-scope grants', () => {
    expect(canSystem(manager, 'PROJECT', 'CREATE')).toBe(true)
    expect(canSystem(manager, 'TASK', 'CREATE')).toBe(false) // a project grant, not a system one
    expect(canSystem(member, 'PROJECT', 'CREATE')).toBe(false)
    expect(canSystem(administrator, 'ROLE', 'EDIT')).toBe(true)
    expect(canSystem(null, 'ROLE', 'EDIT')).toBe(false)
  })
})

describe('canAnywhere', () => {
  it('is true when any project (or the system role) grants it', () => {
    expect(canAnywhere(leader, 'TASK', 'ASSIGN')).toBe(true)
    expect(canAnywhere(manager, 'REPORT', 'GENERATE_REPORTS')).toBe(true)
    expect(canAnywhere(member, 'TASK', 'ASSIGN')).toBe(false)
    expect(canAnywhere(administrator, 'TASK', 'ASSIGN')).toBe(true)
  })
})

describe('projectIdsWhere / projectRoleOf', () => {
  it('filters a list of projects by a grant', () => {
    expect(projectIdsWhere(manager, 'TASK', 'CREATE', [1, 2, 3])).toEqual([1])
  })

  it('names the role held in a project, or null', () => {
    expect(projectRoleOf(manager, 1)).toBe('OWNER')
    expect(projectRoleOf(manager, 2)).toBe('VIEWER')
    expect(projectRoleOf(manager, 3)).toBeNull()
    expect(projectRoleOf(manager, null)).toBeNull()
  })

  it('knows who may override an approver', () => {
    expect(isOwnerOrAdministrator(manager, 1)).toBe(true)
    expect(isOwnerOrAdministrator(manager, 2)).toBe(false)
    expect(isOwnerOrAdministrator(administrator, 99)).toBe(true)
    expect(isOwnerOrAdministrator(leader, 1)).toBe(false)
  })
})

describe('canApproveTask (advisory; the server decides)', () => {
  const task = (extra = {}) => ({ project: { id: 1 }, approver: null, approvalStatus: null, ...extra })

  it('needs TASK:APPROVE in the task\'s project', () => {
    expect(canApproveTask(member, 7, task(), false)).toBe(false)
    expect(canApproveTask(leader, 7, task(), false)).toBe(true)
  })

  it('lets the Owner and an Administrator approve their own work and override a named approver', () => {
    expect(canApproveTask(manager, 7, task(), true)).toBe(true)
    expect(canApproveTask(manager, 7, task({ approver: { id: 99 } }), false)).toBe(true)
    expect(canApproveTask(administrator, 7, task({ approver: { id: 99 } }), true)).toBe(true)
  })

  it('stops anyone else approving their own work', () => {
    expect(canApproveTask(leader, 7, task(), true)).toBe(false)
    expect(canApproveTask(leader, 7, task({ approvalStatus: 'PENDING', approvalRequestedBy: { id: 7 } }), false)).toBe(false)
  })

  it('lets only the named approver decide', () => {
    expect(canApproveTask(leader, 7, task({ approver: { id: 99 } }), false)).toBe(false)
    expect(canApproveTask(leader, 7, task({ approver: { id: 7 } }), false)).toBe(true)
  })
})
