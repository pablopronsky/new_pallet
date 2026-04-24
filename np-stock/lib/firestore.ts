import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  AppConfig,
  Audit,
  Product,
  ProductDistribution,
  Sale,
  UserProfile,
} from "@/types/domain";
import { CONFIG_DOC_ID } from "@/lib/constants";

export const COLLECTIONS = {
  users: "users",
  productos: "productos",
  distribucion: "distribucion",
  ventas: "ventas",
  auditorias: "auditorias",
  config: "config",
} as const;

function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T) {
      const { id: _id, ...rest } = model;
      void _id;
      return rest;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      const data = snapshot.data() as Omit<T, "id">;
      return { id: snapshot.id, ...data } as T;
    },
  };
}

const userConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(model: UserProfile) {
    const { uid: _uid, ...rest } = model;
    void _uid;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): UserProfile {
    const data = snapshot.data() as Omit<UserProfile, "uid">;
    return { uid: snapshot.id, ...data };
  },
};
const productConverter = createConverter<Product>();
const distributionConverter = createConverter<ProductDistribution>();
const saleConverter = createConverter<Sale>();
const auditConverter = createConverter<Audit>();
const configConverter = createConverter<AppConfig>();

export const usersCollection = (): CollectionReference<UserProfile> =>
  collection(db, COLLECTIONS.users).withConverter(userConverter);

export const productsCollection = (): CollectionReference<Product> =>
  collection(db, COLLECTIONS.productos).withConverter(productConverter);

export const distributionCollection = (): CollectionReference<ProductDistribution> =>
  collection(db, COLLECTIONS.distribucion).withConverter(distributionConverter);

export const salesCollection = (): CollectionReference<Sale> =>
  collection(db, COLLECTIONS.ventas).withConverter(saleConverter);

export const auditsCollection = (): CollectionReference<Audit> =>
  collection(db, COLLECTIONS.auditorias).withConverter(auditConverter);

export const configCollection = (): CollectionReference<AppConfig> =>
  collection(db, COLLECTIONS.config).withConverter(configConverter);

export const userDoc = (uid: string): DocumentReference<UserProfile> =>
  doc(usersCollection(), uid);

export const productDoc = (id: string): DocumentReference<Product> =>
  doc(productsCollection(), id);

export const distributionDoc = (
  productId: string,
): DocumentReference<ProductDistribution> => doc(distributionCollection(), productId);

export const saleDoc = (id: string): DocumentReference<Sale> =>
  doc(salesCollection(), id);

export const auditDoc = (id: string): DocumentReference<Audit> =>
  doc(auditsCollection(), id);

export const configDoc = (): DocumentReference<AppConfig> =>
  doc(configCollection(), CONFIG_DOC_ID);
