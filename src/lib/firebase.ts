import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy singletons. Auth/Firestore are initialized on first use (in the browser)
// so they never run during server-side rendering on the Workers runtime, where
// browser globals don't exist.
let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
	if (!appInstance) {
		appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
	}
	return appInstance;
}

export function getFirebaseAuth(): Auth {
	if (!authInstance) authInstance = getAuth(getFirebaseApp());
	return authInstance;
}

export function getDb(): Firestore {
	if (!dbInstance) dbInstance = getFirestore(getFirebaseApp());
	return dbInstance;
}
