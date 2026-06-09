# Conversation Members Module

Controller prefixes:

- `/api/v1/conversation-members`
- `/api/v1/conversations/:conversationId/members`

Tất cả endpoint đều cần Bearer JWT.

## GET /api/v1/conversation-members/:conversationId

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mô tả: Lấy danh sách member của conversation.

### Query params

- `current`: trang hiện tại
- `pageSize`: số bản ghi mỗi trang

## GET /api/v1/conversations/:conversationId/members/mention-search

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mô tả: Tìm candidate để mention trong conversation.

### Query params

- `q`: từ khóa tìm kiếm, có thể bỏ trống

## Lỗi thường gặp

- `403 Forbidden`: user không đủ quyền đọc conversation
- `404 Not Found`: conversation không tồn tại
