# Workspaces Module

Controller prefix: `/api/v1/workspace`

Tất cả endpoint đều cần Bearer JWT.

## POST /api/v1/workspace

- Mô tả: Tạo workspace mới. User tạo ra thường trở thành owner.

### Body

```json
{
  "name": "Engineering",
  "slug": "engineering",
  "iconUrl": "https://example.com/icon.png"
}
```

## GET /api/v1/workspace/

- Mô tả: Lấy danh sách workspace của user hiện tại.

### Query params

- `current`: trang hiện tại
- `pageSize`: số bản ghi mỗi trang

## GET /api/v1/workspace/:id

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mô tả: Lấy chi tiết workspace nếu user là member và có quyền đọc.

## PATCH /api/v1/workspace/:id

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Update)`
- Mô tả: Cập nhật workspace.

### Body

```json
{
  "name": "Engineering Core",
  "slug": "engineering-core",
  "iconUrl": "https://example.com/new-icon.png"
}
```

## DELETE /api/v1/workspace/:id

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Delete)`
- Mô tả: Xóa mềm workspace.

## Lỗi thường gặp

- `400 Bad Request`: slug sai format
- `401 Unauthorized`: thiếu hoặc sai JWT
- `403 Forbidden`: không đủ quyền trên workspace
- `404 Not Found`: workspace không tồn tại
