# Workspace Members Module

Controller prefix: `/api/v1/workspace-members`

Tất cả endpoint đều cần Bearer JWT.

## GET /api/v1/workspace-members/:workspaceId

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mô tả: Lấy danh sách thành viên của workspace.

### Query params

- `current`: trang hiện tại
- `pageSize`: số bản ghi mỗi trang

## PATCH /api/v1/workspace-members/:workspaceId/:userId/grant-role

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Kick)`
- Mô tả: Cấp role cho workspace member.

### Query params

- `role`: `OWNER | ADMIN | MEMBER | GUEST`

## DELETE /api/v1/workspace-members/:workspaceId/:userId/kick

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Kick)`
- Mô tả: Kick thành viên khỏi workspace.

## DELETE /api/v1/workspace-members/:workspaceId/leave

- Guard: `WorkspaceMemberGuard`
- Mô tả: User hiện tại rời workspace.

## Lỗi thường gặp

- `403 Forbidden`: không đủ quyền quản lý thành viên
- `404 Not Found`: workspace hoặc member không tồn tại
