# Workspace Invite Module

Controller prefix: `/api/v1/workspace-invite`

Tất cả endpoint yêu cầu JWT; một số endpoint còn yêu cầu guard/policy workspace.

## GET /api/v1/workspace-invite/:workspaceId

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mô tả: Lấy danh sách invite của workspace.

### Query params

- `current`: trang hiện tại
- `pageSize`: số bản ghi mỗi trang
- `type`: loại invite
- `status`: trạng thái invite

## POST /api/v1/workspace-invite/:workspaceId/direct

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mô tả: Tạo direct invite theo email.

### Body

```json
{
  "invitedEmail": "user@example.com"
}
```

## POST /api/v1/workspace-invite/:workspaceId/link

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mô tả: Tạo invite link cho workspace.

### Body

```json
{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

## POST /api/v1/workspace-invite/accept-direct

- Mô tả: Chấp nhận direct invite bằng token.

### Body

```json
{
  "token": "direct-invite-token"
}
```

## POST /api/v1/workspace-invite/accept-link

- Mô tả: Chấp nhận invite link bằng token.

### Body

```json
{
  "token": "invite-token"
}
```

## POST /api/v1/workspace-invite/deny

- Mô tả: Từ chối direct invite.

### Body

```json
{
  "token": "direct-invite-token"
}
```

## PATCH /api/v1/workspace-invite/:inviteId/revoke

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mô tả: Thu hồi invite.

## Lỗi thường gặp

- `400 Bad Request`: token không hợp lệ, invite hết hạn hoặc đã xử lý
- `403 Forbidden`: không đủ quyền tạo/thu hồi invite
- `404 Not Found`: invite không tồn tại
