# Workspaces Module

Controller prefix: `/api/v1/workspace`

Tat ca endpoint deu can Bearer JWT.

## POST /api/v1/workspace

- Mo ta: Tao workspace moi. User tao ra thuong tro thanh owner.

### Body

```json
{
  "name": "Engineering",
  "slug": "engineering",
  "iconUrl": "https://example.com/icon.png"
}
```

## GET /api/v1/workspace/

- Mo ta: Lay danh sach workspace cua user hien tai.

### Query params

- `current`: trang hien tai
- `pageSize`: so ban ghi moi trang

## GET /api/v1/workspace/:id

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mo ta: Lay chi tiet workspace neu user la member va co quyen doc.

## PATCH /api/v1/workspace/:id

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Update)`
- Mo ta: Cap nhat workspace.

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
- Mo ta: Xoa mem workspace.

## Loi thuong gap

- `400 Bad Request`: slug sai format
- `401 Unauthorized`: thieu hoac sai JWT
- `403 Forbidden`: khong du quyen tren workspace
- `404 Not Found`: workspace khong ton tai
