import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  QueryDocumentSnapshot, 
  FirestoreDataConverter,
  DocumentData,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { CatalogItem, Dish, Production, InventoryEvent } from '../data';

/**
 * Generic converter to maintain TypeScript types when interacting with Firestore.
 * Automatically handles the 'id' field by mapping it to the Firestore document ID.
 */
const createConverter = <T extends { id: string }>(): FirestoreDataConverter<T> => ({
  toFirestore(data: T): DocumentData {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = data;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): T {
    const data = snapshot.data();
    return { id: snapshot.id, ...data } as T;
  }
});

export const catalogConverter = createConverter<CatalogItem>();
export const dishConverter = createConverter<Dish>();
export const productionConverter = createConverter<Production>();
export const inventoryEventConverter = createConverter<InventoryEvent>();

export const firebaseService = {
  /**
   * Subscribes to a Firestore collection and updates the local state via callback.
   */
  subscribeToCollection: <T extends { id: string }>(
    collectionName: string, 
    converter: FirestoreDataConverter<T>,
    callback: (data: T[]) => void
  ) => {
    const q = query(collection(db, collectionName).withConverter(converter));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      callback(items);
    });
  },

  /**
   * Saves or updates an item in Firestore.
   */
  saveItem: async <T extends { id: string }>(
    collectionName: string, 
    item: T,
    converter: FirestoreDataConverter<T>
  ) => {
    const docRef = doc(db, collectionName, item.id).withConverter(converter);
    await setDoc(docRef, item);
  },

  /**
   * Deletes an item from Firestore.
   */
  deleteItem: async (collectionName: string, id: string) => {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  },

  /**
   * Checks if a collection is empty (useful for seeding).
   */
  isCollectionEmpty: async (collectionName: string): Promise<boolean> => {
    const q = query(collection(db, collectionName), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  }
};
