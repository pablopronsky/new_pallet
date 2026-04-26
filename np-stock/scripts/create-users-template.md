# Firebase Admin user setup

Use `scripts/create-users.ts` to create or update the NP Stock Firebase Auth
users and their matching Firestore profiles.

The script writes each profile to `users/{uid}`, where `{uid}` is the Firebase
Auth UID. It never uses email as the Firestore document ID.

## 1. Download a service account JSON

1. Open Firebase Console.
2. Go to Project Settings > Service accounts.
3. Click Generate new private key.
4. Save the JSON outside the repository.

Do not commit the service account JSON or paste it into source code.

## 2. Set environment variables

The script requires:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `ADMIN_PASSWORD`
- `CONTROLADOR_PASSWORD`
- `QUILMES_PASSWORD`
- `GONNET_PASSWORD`
- `LAPLATA_PASSWORD`
- `ALLCOVERING_PASSWORD`

### Windows Git Bash

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/c/path/to/serviceAccount.json"
export ADMIN_PASSWORD="ninguna"
export CONTROLADOR_PASSWORD="controlador123"
export QUILMES_PASSWORD="quilmes123"
export GONNET_PASSWORD="gonnet123"
export LAPLATA_PASSWORD="laplata123"
export ALLCOVERING_PASSWORD="allcovering123"
npm run setup:users
```

### PowerShell

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccount.json"
$env:ADMIN_PASSWORD="ninguna"
$env:CONTROLADOR_PASSWORD="controlador123"
$env:QUILMES_PASSWORD="quilmes123"
$env:GONNET_PASSWORD="gonnet123"
$env:LAPLATA_PASSWORD="laplata123"
$env:ALLCOVERING_PASSWORD="allcovering123"
npm run setup:users
```

## 3. What the script creates

| Email | Role | sucursalAsignada |
| --- | --- | --- |
| pronskypablo@gmail.com | admin | |
| controlador@np.com | controlador | |
| quilmes@np.com | vendedor | quilmes |
| gonnet@np.com | vendedor | gonnet |
| laplata@np.com | vendedor | laplata |
| allcovering@np.com | allcovering | |

For every account, the Firestore document includes `uid`, `email`, `nombre`,
`role`, `activo`, and `sucursalAsignada` when applicable.
