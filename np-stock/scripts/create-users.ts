/**
 * Local Firebase Admin setup for initial NP Stock users.
 *
 * Authentication:
 * 1. Download a service account JSON from Firebase Console >
 *    Project Settings > Service accounts.
 * 2. Store it outside the repo, or use a local ignored filename such as
 *    serviceAccount.local.json.
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS to that JSON path before running.
 *
 * Never commit the service account JSON file.
 *
 * Run:
 *   npm run setup:users
 */

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Branch, Role } from "../types/domain";

const requiredEnvVars = [
  "GOOGLE_APPLICATION_CREDENTIALS",
  "ADMIN_PASSWORD",
  "QUILMES_PASSWORD",
  "GONNET_PASSWORD",
  "LAPLATA_PASSWORD",
  "ALLCOVERING_PASSWORD",
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type PasswordEnvVar = Exclude<RequiredEnvVar, "GOOGLE_APPLICATION_CREDENTIALS">;

interface UserSeed {
  email: string;
  passwordEnv: PasswordEnvVar;
  nombre: string;
  role: Role;
  sucursalAsignada?: Branch;
}

const users: UserSeed[] = [
  {
    email: "pronskypablo@gmail.com",
    passwordEnv: "ADMIN_PASSWORD",
    nombre: "Pablo Pronsky",
    role: "admin",
  },
  {
    email: "quilmes@np.com",
    passwordEnv: "QUILMES_PASSWORD",
    nombre: "Vendedor Quilmes",
    role: "vendedor",
    sucursalAsignada: "quilmes",
  },
  {
    email: "gonnet@np.com",
    passwordEnv: "GONNET_PASSWORD",
    nombre: "Vendedor Gonnet",
    role: "vendedor",
    sucursalAsignada: "gonnet",
  },
  {
    email: "laplata@np.com",
    passwordEnv: "LAPLATA_PASSWORD",
    nombre: "Vendedor La Plata",
    role: "vendedor",
    sucursalAsignada: "laplata",
  },
  {
    email: "allcovering@np.com",
    passwordEnv: "ALLCOVERING_PASSWORD",
    nombre: "All Covering",
    role: "allcovering",
  },
];

function requireEnv(name: RequiredEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function assertRequiredEnvironment(): void {
  const missing = requiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}.`,
    );
  }
}

async function getOrCreateAuthUser(seed: UserSeed): Promise<UserRecord> {
  const auth = getAuth();
  const password = requireEnv(seed.passwordEnv);

  try {
    const existing = await auth.getUserByEmail(seed.email);
    await auth.updateUser(existing.uid, {
      displayName: seed.nombre,
      password,
      disabled: false,
    });
    console.log(`= updated auth user: ${seed.email} (${existing.uid})`);
    return auth.getUser(existing.uid);
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";

    if (code !== "auth/user-not-found") {
      throw err;
    }

    const created = await auth.createUser({
      email: seed.email,
      password,
      displayName: seed.nombre,
      disabled: false,
      emailVerified: false,
    });
    console.log(`+ created auth user: ${seed.email} (${created.uid})`);
    return created;
  }
}

async function upsertUserProfile(user: UserRecord, seed: UserSeed): Promise<void> {
  const db = getFirestore();
  const payload = {
    uid: user.uid,
    email: seed.email,
    nombre: seed.nombre,
    role: seed.role,
    sucursalAsignada: seed.sucursalAsignada ?? FieldValue.delete(),
    activo: true,
  };

  await db.collection("users").doc(user.uid).set(payload, { merge: true });
}

function printSummary(user: UserRecord, seed: UserSeed): void {
  const summary = [
    `email=${seed.email}`,
    `uid=${user.uid}`,
    `role=${seed.role}`,
    seed.sucursalAsignada ? `sucursalAsignada=${seed.sucursalAsignada}` : null,
  ]
    .filter((item): item is string => item !== null)
    .join(" | ");

  console.log(summary);
}

async function main(): Promise<void> {
  assertRequiredEnvironment();

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }

  console.log("Setting up Firebase Auth users and Firestore profiles...\n");

  for (const seed of users) {
    const user = await getOrCreateAuthUser(seed);
    await upsertUserProfile(user, seed);
    printSummary(user, seed);
  }

  console.log(`\nDone. Wrote ${users.length} Firestore profile(s) under users/{uid}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("User seed failed:", err);
    process.exit(1);
  });
