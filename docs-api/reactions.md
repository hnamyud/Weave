# Reactions Module

Controller prefix: `/api/v1/reactions`

Tai thoi diem doc code, `ReactionsController` da duoc khai bao nhung chua expose HTTP endpoint nao.

## Hien trang

- Co controller va service
- Chua co `@Get`, `@Post`, `@Patch`, `@Delete`
- Realtime event type co dinh nghia `reaction:added` va `reaction:removed`, nhung khong thay luong emit trong pham vi code da kiem tra
