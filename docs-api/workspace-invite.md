# Workspace Invite Module

Controller prefix: `/api/v1/workspace-invite`

Tat ca endpoint yeu cau JWT; mot so endpoint con yeu cau guard/policy workspace.

## GET /api/v1/workspace-invite/:workspaceId

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mo ta: Lay danh sach invite cua workspace.

### Query params

- `current`: trang hien tai
- `pageSize`: so ban ghi moi trang
- `type`: loai invite
- `status`: trang thai invite

## POST /api/v1/workspace-invite/:workspaceId/direct

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mo ta: Tao direct invite theo email.

### Body

```json
{
  "invitedEmail": "user@example.com"
}
```

## POST /api/v1/workspace-invite/:workspaceId/link

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mo ta: Tao invite link cho workspace.

### Body

```json
{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

## POST /api/v1/workspace-invite/accept-direct

- Mo ta: Chap nhan direct invite bang token.

### Body

```json
{
  "token": "direct-invite-token"
}
```

## POST /api/v1/workspace-invite/accept-link

- Mo ta: Chap nhan invite link bang token.

### Body

```json
{
  "token": "invite-token"
}
```

## POST /api/v1/workspace-invite/deny

- Mo ta: Tu choi direct invite.

### Body

```json
{
  "token": "direct-invite-token"
}
```

## PATCH /api/v1/workspace-invite/:inviteId/revoke

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Manage)`
- Mo ta: Thu hoi invite.

## Loi thuong gap

- `400 Bad Request`: token khong hop le, invite het han hoac da xu ly
- `403 Forbidden`: khong du quyen tao/thu hoi invite
- `404 Not Found`: invite khong ton tai
