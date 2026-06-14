# Conversations Module

Controller prefix: `/api/v1/conversation`

Tất cả endpoint đều cần Bearer JWT.

## POST /api/v1/conversation

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Create)`
- Mô tả: Tạo conversation mới trong workspace.

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

### Ghi chú

- `type` được định nghĩa trong enum `ConversationType`.
- DTO không đánh dấu `name` và `description` là bắt buộc, nhưng service có thể áp thêm rule theo loại conversation.

## POST /api/v1/conversation/:conversationId/join

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireConversationPermission(Action.Join)`
- Mô tả: Join vào conversation.

## POST /api/v1/conversation/:id/leave

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Leave)`
- Mô tả: Rời khỏi conversation.

## POST /api/v1/conversation/:conversationId/private-members

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Add)`
- Mô tả: Thêm member vào private channel.

### Body

```json
{
  "userId": "236100d1-83d0-4b94-a733-7cffdf4d3fd7"
}
```

## DELETE /api/v1/conversation/:conversationId/private-members/:userId

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Kick)`
- Mô tả: Xóa member khỏi private channel.

## GET /api/v1/conversation/workspace/:workspaceId

- Guard: `WorkspaceMemberGuard`
- Policy: `RequireWorkspacePermission(Action.Read)`
- Mô tả: Lấy danh sách conversation mà user là member trong workspace (dùng cho sidebar). Public và private channel hiện như nhau; phân biệt qua `isPrivate`.

### Response

```json
[
  {
    "id": "0190f3a1-1c2b-7d4e-9f10-2a3b4c5d6e7f",
    "name": "backend",
    "type": "CHANNEL",
    "isPrivate": false
  }
]
```

### Ghi chú

- Sắp xếp theo `name` tăng dần (A→Z).
- Trả về mảng rỗng nếu user chưa join conversation nào.
- Cần thông tin chi tiết (số member, ...) thì gọi `GET /api/v1/conversation/:id`.

## GET /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mô tả: Lấy thông tin conversation.

## PATCH /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Update)`
- Mô tả: Cập nhật conversation.

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
- Mô tả: Archive conversation.

## PATCH /api/v1/conversation/:id/unarchive

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Archive)`
- Mô tả: Unarchive conversation.

## DELETE /api/v1/conversation/:id

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Delete)`
- Mô tả: Soft-delete conversation.

## Lỗi thường gặp

- `403 Forbidden`: không đủ quyền trên conversation/workspace
- `404 Not Found`: conversation không tồn tại
