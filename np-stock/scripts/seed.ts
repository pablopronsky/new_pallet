/**
 * Idempotent seed script. Run with:
 *   npm run seed
 *
 * Reads Firebase config from .env.local (same as the app) via dotenv.
 * Safe to run multiple times: products are matched by `nombre`; existing
 * products are not overwritten, and distribution docs are only created if
 * missing.
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  doc,
  collection,
} from "firebase/firestore";
import type { Product, ProductDistribution, AppConfig, Branch } from "../types/domain";
import {
  BRANCHES,
  CONFIG_DOC_ID,
  DEFAULT_TIPO_CAMBIO_USD,
  INITIAL_PRODUCTS,
} from "../lib/constants";

loadEnv({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function assertConfig(): void {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase env vars: ${missing.join(", ")}. Check .env.local`,
    );
  }
}

function zeroedBranchBoxes(): Record<Branch, number> {
  return BRANCHES.reduce(
    (acc, b) => {
      acc[b] = 0;
      return acc;
    },
    {} as Record<Branch, number>,
  );
}

async function seed(): Promise<void> {
  assertConfig();

  const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const productsRef = collection(db, "productos");
  const distributionRef = collection(db, "distribucion");

  let created = 0;
  let skipped = 0;

  for (const p of INITIAL_PRODUCTS) {
    const existing = await getDocs(query(productsRef, where("nombre", "==", p.nombre)));

    let productId: string;
    if (!existing.empty) {
      productId = existing.docs[0]!.id;
      skipped += 1;
      console.log(`= product exists: ${p.nombre} (${productId})`);
    } else {
      const newDocRef = doc(productsRef);
      productId = newDocRef.id;
      const payload: Omit<Product, "id"> = {
        ...p,
        createdAt: serverTimestamp() as unknown as Product["createdAt"],
        updatedAt: serverTimestamp() as unknown as Product["updatedAt"],
      };
      await setDoc(newDocRef, payload);
      created += 1;
      console.log(`+ created product: ${p.nombre} (${productId})`);
    }

    const distRef = doc(distributionRef, productId);
    const distSnap = await getDoc(distRef);
    if (!distSnap.exists()) {
      const distPayload: Omit<ProductDistribution, "id"> = {
        productId,
        cajasPorSucursal: zeroedBranchBoxes(),
        updatedAt: serverTimestamp() as unknown as ProductDistribution["updatedAt"],
      };
      await setDoc(distRef, distPayload);
      console.log(`+ created distribution for: ${p.nombre}`);
    } else {
      console.log(`= distribution exists for: ${p.nombre}`);
    }
  }

  const configRef = doc(db, "config", CONFIG_DOC_ID);
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    const configPayload: Omit<AppConfig, "id"> = {
      tipoCambioUSD: DEFAULT_TIPO_CAMBIO_USD,
      updatedAt: serverTimestamp() as unknown as AppConfig["updatedAt"],
    };
    await setDoc(configRef, configPayload);
    console.log(`+ created config doc with tipoCambioUSD=${DEFAULT_TIPO_CAMBIO_USD}`);
  } else {
    console.log(`= config doc exists`);
  }

  console.log(
    `\nDone. products created=${created}, products skipped=${skipped}, total=${INITIAL_PRODUCTS.length}`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
