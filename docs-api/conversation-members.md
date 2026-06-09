# Conversation Members Module

Controller prefixes:

- `/api/v1/conversation-members`
- `/api/v1/conversations/:conversationId/members`

Tat ca endpoint deu can Bearer JWT.

## GET /api/v1/conversation-members/:conversationId

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mo ta: Lay danh sach member cua conversation.

### Query params

- `current`: trang hien tai
- `pageSize`: so ban ghi moi trang

## GET /api/v1/conversations/:conversationId/members/mention-search

- Guard: `ConversationMemberGuard`
- Policy: `RequireConversationPermission(Action.Read)`
- Mo ta: Tim candidate de mention trong conversation.

### Query params

- `q`: tu khoa tim kiem, co the bo trong

## Loi thuong gap

- `403 Forbidden`: user khong du quyen doc conversation
- `404 Not Found`: conversation khong ton tai
