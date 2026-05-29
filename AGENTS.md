# AGENTS.md

## Project Overview

Weave is a NestJS backend for a Slack-like real-time collaboration and messaging platform.

Main stack:

* NestJS 11
* TypeScript
* Prisma ORM
* PostgreSQL
* Socket.IO / WebSocket
* Redis / BullMQ
* CASL for authorization
* JWT + refresh token authentication
* Swagger API documentation

The project is a modular monolith. Keep features inside `src/modules/*` unless the logic is truly shared.

## Common Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run test:cov
```

Before finishing a code task, prefer running:

```bash
npm run lint
npm run build
```

Run tests when the changed area already has tests or when the task affects auth, permission, message, workspace, or realtime behavior.

## Project Structure

Important folders:

```txt
src/
  common/        Shared guards, interceptors, CASL, cache, decorators, filters
  config/        App/security configuration
  modules/       Feature modules
  shared/        Shared providers/utilities
  app.module.ts
  main.ts

prisma/
  schema.prisma
```

Main feature modules:

* `auth`
* `users`
* `workspaces`
* `workspace_members`
* `workspace_invite`
* `conversations`
* `conversation_members`
* `messages`
* `files`
* `notifications`
* `realtime`
* `search`

## Coding Rules

* Follow existing NestJS module style: `controller`, `service`, `module`, DTOs, guards/policies where needed.
* Validate request body/query/params using DTOs and `class-validator`.
* Do not manually accept unknown request fields; global validation uses whitelist and forbids non-whitelisted fields.
* Keep business logic in services, not controllers.
* Controllers should mainly handle routing, request extraction, and response delegation.
* Reuse existing guards, decorators, CASL policies, and Prisma service patterns before adding new abstractions.
* Do not bypass authorization checks for workspace, conversation, message, file, invite, or notification APIs.
* Prefer explicit errors using NestJS exceptions such as `BadRequestException`, `ForbiddenException`, `NotFoundException`, and `UnauthorizedException`.

## API Rules

* API routes are versioned under `/api/v1`.
* Most endpoints require JWT unless explicitly marked public.
* Use Swagger decorators for new public APIs when practical.
* POST is for create/actions.
* PATCH is preferred for partial updates.
* DELETE should usually soft-delete if the model supports `isDeleted` / `deletedAt`.

## Database Rules

* Prisma schema is the source of truth for data models.
* IDs are UUID strings. When creating records, follow the project’s existing UUID generation approach.
* Use `@map` / `@@map` consistently with existing snake_case database columns.
* Do not replace the unified `Conversation` model with separate channel/dm tables.
* `Conversation.type` supports:

  * `CHANNEL`
  * `DM`
  * `GROUP_DM`
* Always check membership before allowing access to workspace/conversation data.
* Respect soft-delete fields:

  * `isDeleted`
  * `deletedAt`
  * `leftAt`
  * `revokedAt`
* Do not hard-delete messages, workspaces, conversations, bots, or users unless explicitly requested.
* When adding indexes, prefer indexes that match real query patterns such as:

  * workspace lookup
  * conversation message pagination
  * unread notifications
  * invite lookup
  * refresh token cleanup

## Auth Rules

* Access token is sent as Bearer token.
* Refresh tokens are stored in the database as hashes, not raw tokens.
* Refresh token logic must support multiple devices.
* Refresh token rotation should preserve device information when appropriate.
* Logout should revoke refresh tokens and clear cookies when cookies are used.
* OAuth users may have nullable passwords.
* Do not allow soft-deleted users to login through local auth or OAuth.
* Do not leak access tokens in URL query strings.
* OAuth flows should use state protection.

## Permission Rules

* Use CASL/policy-based authorization for sensitive actions.
* Workspace roles:

  * `OWNER`
  * `ADMIN`
  * `MEMBER`
  * `GUEST`
* Conversation roles:

  * `ADMIN`
  * `MEMBER`
  * `GUEST`
* Owner/admin actions must not be implemented as simple userId checks unless the existing design already does that.
* Before accessing a conversation, verify:

  * the conversation exists
  * it is not deleted/archived when relevant
  * the user is a member of the workspace
  * the user is allowed to access the conversation

## Messaging Rules

* Messages belong to conversations.
* Thread replies use `parentId`.
* Message deletion should usually mark:

  * `isDeleted = true`
  * `deletedAt = now`
* Message edits should mark:

  * `isEdited = true`
  * `editedAt = now`
* Keep attachment, mention, reaction, pinned message, and notification behavior consistent with the schema.
* Reactions must respect unique `(messageId, userId, emoji)` behavior.

## Realtime Rules

* Realtime events should be emitted after the database write succeeds.
* Do not emit events before permission checks pass.
* Realtime payloads should not expose sensitive fields such as password, token hashes, or internal auth data.
* Prefer event names that clearly describe the action, for example:

  * `message.created`
  * `message.updated`
  * `message.deleted`
  * `reaction.created`
  * `notification.created`

## File / Attachment Rules

* Attachments belong to messages.
* Store metadata in the existing `metadata` JSON field when needed.
* Do not store raw file content in PostgreSQL.
* Validate file size/type before upload logic is finalized.
* Keep file ownership through `uploaderId`.

## Notification Rules

* Notifications belong to user + workspace.
* Mention, DM, thread reply, reaction, and bot notifications should respect `NotificationSetting`.
* Unread notification queries should use indexed fields where possible.
* Avoid sending duplicate notifications for the actor who triggered the event.

## Security Rules

* Never commit secrets or `.env` files.
* Do not expose:

  * password hashes
  * refresh token hashes
  * OAuth provider internal data
  * raw tokens
* Keep Helmet, CORS, cookie parser, global guards, validation pipe, and transform interceptor behavior intact unless explicitly changing app bootstrap behavior.
* Be careful when changing auth, cookies, CORS, OAuth, refresh token, and CASL logic.

## Prisma Rules

* After changing `schema.prisma`, generate Prisma client.
* Create migrations for schema changes instead of relying on direct DB push for production-like work.
* Keep relation names and mapped column names consistent.
* Be careful with nullable password because OAuth users may not have local credentials.
* Do not remove partial unique indexes or soft-delete-aware uniqueness without checking the auth/user flow.

## Response / Output Rules

* Global response transformation is handled by `TransformInterceptor`.
* Do not manually wrap every controller response unless the existing pattern requires it.
* Keep returned user objects sanitized.
* Avoid returning Prisma entities directly if they contain sensitive fields.

## When Adding a New Feature

1. Add or update Prisma model if needed.
2. Add DTOs with validation.
3. Add service logic.
4. Add controller endpoint.
5. Add authorization checks.
6. Add realtime event if the feature affects live UI.
7. Add notification logic if users should be alerted.
8. Update Swagger decorators if the endpoint is public-facing.
9. Run build/lint/tests.

## Do Not Do

* Do not rewrite the project structure into microservices.
* Do not introduce TypeORM.
* Do not split `Conversation` into separate `Channel`, `DM`, and `GroupDM` tables.
* Do not remove CASL authorization.
* Do not hard-code environment variables.
* Do not store raw refresh tokens.
* Do not send access tokens in redirect query strings.
* Do not skip membership checks for workspace/conversation resources.
