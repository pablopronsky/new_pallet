/**
 * Idempotent Firebase Admin seed script. Run with:
 *   npm run seed
 *
 * Authentication:
 * 1. Download a service account JSON from Firebase Console >
 *    Project Settings > Service accounts.
 * 2. Store it outside the repo, or use a local ignored filename.
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS to that JSON path before running.
 *
 * Never commit the service account JSON file.
 */

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  BRANCHES,
  CONFIG_DOC_ID,
  DEFAULT_TIPO_CAMBIO_USD,
  INITIAL_PRODUCTS,
} from "../lib/constants";
import type { Branch, BranchBoxes } from "../types/domain";

function assertRequiredEnvironment(): void {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required.");
  }
}

function zeroedBranchBoxes(): BranchBoxes {
  return BRANCHES.reduce(
    (acc, branch: Branch) => {
      acc[branch] = 0;
      return acc;
    },
    {} as BranchBoxes,
  );
}

async function seed(): Promise<void> {
  assertRequiredEnvironment();

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }

  const db = getFirestore();
  const productsRef = db.collection("productos");
  const distributionRef = db.collection("distribucion");

  let created = 0;
  let skipped = 0;

  for (const product of INITIAL_PRODUCTS) {
    const existing = await productsRef
      .where("nombre", "==", product.nombre)
      .limit(1)
      .get();

    let productId: string;

    if (!existing.empty) {
      productId = existing.docs[0]!.id;
      skipped += 1;
      console.log(`= product exists: ${product.nombre} (${productId})`);
    } else {
      const newProductRef = productsRef.doc();
      productId = newProductRef.id;

      await newProductRef.set({
        ...product,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      created += 1;
      console.log(`+ created product: ${product.nombre} (${productId})`);
    }

    const distributionDoc = distributionRef.doc(productId);
    const distributionSnap = await distributionDoc.get();

    if (!distributionSnap.exists) {
      await distributionDoc.set({
        productId,
        cajasPorSucursal: zeroedBranchBoxes(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`+ created distribution for: ${product.nombre}`);
    } else {
      console.log(`= distribution exists for: ${product.nombre}`);
    }
  }

  const configDoc = db.collection("config").doc(CONFIG_DOC_ID);
  const configSnap = await configDoc.get();

  if (!configSnap.exists) {
    await configDoc.set({
      tipoCambioUSD: DEFAULT_TIPO_CAMBIO_USD,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(
      `+ created config doc with tipoCambioUSD=${DEFAULT_TIPO_CAMBIO_USD}`,
    );
  } else {
    console.log("= config doc exists");
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
