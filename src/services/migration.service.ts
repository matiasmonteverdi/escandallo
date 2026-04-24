import { db } from '../firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

export async function migrateCatalogActiveFlag() {
  console.log('Starting catalog migration: active=true');
  const catalogRef = collection(db, 'catalog');
  const snapshot = await getDocs(catalogRef);
  
  const batch = writeBatch(db);
  let count = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.active === undefined) {
      batch.update(doc.ref, { active: true });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Migration complete. Updated ${count} items.`);
  } else {
    console.log('No items needed migration.');
  }
}
