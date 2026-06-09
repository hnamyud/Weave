# Workspace Members Module

Controller prefix: `/api/v1/workspace-members`

Tat ca endpoint deu can Bearer JWT.

## GET /api/v1/workspace-members/:workspaceId

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mo ta: Lay danh sach thanh vien cua workspace.

### Query params

- `current`: trang hien tai
- `pageSize`: so ban ghi moi trang

## PATCH /api/v1/workspace-members/:workspaceId/:userId/grant-role

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Kick)`
- Mo ta: Cap role cho workspace member.

### Query params

- `role`: `OWNER | ADMIN | MEMBER | GUEST`

## DELETE /api/v1/workspace-members/:workspaceId/:userId/kick

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Kick)`
- Mo ta: Kick thanh vien khoi workspace.

## DELETE /api/v1/workspace-members/:workspaceId/leave

- Guard: `WorkspaceMemberGuard`
- Mo ta: User hien tai roi workspace.

## Loi thuong gap

- `403 Forbidden`: khong du quyen quan ly thanh vien
- `404 Not Found`: workspace hoac member khong ton tai
