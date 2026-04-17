import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiXqeN6BQ7Vm-Z8IgJXebDvRH4EtESNGE",
  authDomain: "escandallopana.firebaseapp.com",
  projectId: "escandallopana",
  storageBucket: "escandallopana.firebasestorage.app",
  messagingSenderId: "463762152489",
  appId: "1:463762152489:web:d0a7f32fb471f2ee355038"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
