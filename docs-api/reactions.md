# Reactions Module

Controller prefix: `/api/v1/reactions`

Tại thời điểm đọc code, `ReactionsController` đã được khai báo nhưng chưa expose HTTP endpoint nào.

## Hiện trạng

- Có controller và service
- Chưa có `@Get`, `@Post`, `@Patch`, `@Delete`
- Realtime event type có định nghĩa `reaction:added` và `reaction:removed`, nhưng không thấy luồng emit trong phạm vi code đã kiểm tra
