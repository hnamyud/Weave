# Mailer Module

Controller prefix: `/api/v1/mail`

## POST /api/v1/mail/reset-password

- Auth: Public
- Throttle: toi da 1 request / 60 giay theo rule `short`
- Mo ta: Gui ma OTP reset password qua email.

### Body

```json
{
  "email": "john@example.com"
}
```

### Response

```json
{
  "statusCode": 201,
  "message": "Reset password code has sent!",
  "data": {}
}
```
