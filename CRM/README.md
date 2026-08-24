# CRM

## Development

From the `CRM/` directory:

```cmd
npm install
npm run dev
```

Open `http://localhost:3000`. The development user is `demo@example.com` with password `Password123!`.

## Verification

```cmd
npm test
npm run build
```

The login service uses bcrypt password hashes and an in-memory HTTP-only session cookie for this initial scaffold. Customer records use Node 24's built-in SQLite support and are stored at `data/crm.sqlite` by default. Set `CRM_DATABASE_PATH` to change the location; keep the database file outside source control. Provide HTTPS before production deployment.