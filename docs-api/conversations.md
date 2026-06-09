# Conversations Module

Controller prefix: `/api/v1/conversation`

Tat ca endpoint deu can Bearer JWT.

## POST /api/v1/conversation

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Create)`
- Mo ta: Tao conversation moi trong workspace.

### Body

```json
{
  "workspaceId": "4e85bb0d-17c3-4cf2-bd75-18d92f76f7d4",
  "type": "CHANNEL",
  "name": "backend",
  "description": "Backend discussion",
  "isPrivate": false,
  "isArchived": false
}
```

### Ghi chu

- `type` duoc dinh nghia trong enum `ConversationType`.
- DTO khong danh dau `name` va `description` la bat buoc, nhung service co the ap them rule theo loai conversation.

## POST /api/v1/conversation/:conversationId/join

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireConversationPermission(Action.Join)`
- Mo ta: Join vao conversation.

## POST /api/v1/conversation/:id/leave

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Leave)`
- Mo ta: Roi khoi conversation.

## POST /api/v1/conversation/:conversationId/private-members

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Add)`
- Mo ta: Them member vao private channel.

### Body

```json
{
  "userId": "236100d1-83d0-4b94-a733-7cffdf4d3fd7"
}
```

## DELETE /api/v1/conversation/:conversationId/private-members/:userId

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Kick)`
- Mo ta: Xoa member khoi private channel.

## GET /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mo ta: Lay thong tin conversation.

## PATCH /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Update)`
- Mo ta: Cap nhat conversation.

### Body

```json
{
  "name": "backend-platform",
  "description": "Platform team channel",
  "isPrivate": true
}
```

## PATCH /api/v1/conversation/:id/archive

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Archive)`
- Mo ta: Archive conversation.

## PATCH /api/v1/conversation/:id/unarchive

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Archive)`
- Mo ta: Unarchive conversation.

## DELETE /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Delete)`
- Mo ta: Soft-delete conversation.

## Loi thuong gap

- `403 Forbidden`: khong du quyen tren conversation/workspace
- `404 Not Found`: conversation khong ton tai
