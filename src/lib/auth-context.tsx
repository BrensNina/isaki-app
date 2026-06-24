"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import {
	createUserWithEmailAndPassword,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	updateProfile,
	type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase";
import type { Rol } from "./types";

/** Rol asignado por defecto a las cuentas nuevas en el prototipo. En el sistema
 *  final, el administrador asigna el rol al crear la cuenta (HU-01). */
const ROL_POR_DEFECTO: Rol = "vendedor";

export interface UserProfile {
	uid: string;
	email: string | null;
	displayName: string | null;
	photoURL: string | null;
	rol: Rol;
	bio?: string;
	createdAt?: unknown;
	updatedAt?: unknown;
}

interface AuthContextValue {
	user: User | null;
	profile: UserProfile | null;
	loading: boolean;
	signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
	signInWithEmail: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Create the user's profile doc if missing, then return its data. */
async function ensureProfile(user: User): Promise<UserProfile> {
	const ref = doc(getDb(), "users", user.uid);
	const snap = await getDoc(ref);

	if (!snap.exists()) {
		const profile: UserProfile = {
			uid: user.uid,
			email: user.email,
			displayName: user.displayName,
			photoURL: user.photoURL,
			rol: ROL_POR_DEFECTO,
			bio: "",
		};
		await setDoc(ref, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
		return profile;
	}

	const data = snap.data() as UserProfile;

	// Migración suave: cuentas creadas antes de existir el campo `rol`.
	if (!data.rol) {
		await updateDoc(ref, { rol: ROL_POR_DEFECTO, updatedAt: serverTimestamp() });
		data.rol = ROL_POR_DEFECTO;
	}

	return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(getFirebaseAuth(), async (u) => {
			setUser(u);
			setProfile(u ? await ensureProfile(u) : null);
			setLoading(false);
		});
		return unsub;
	}, []);

	async function refreshProfile() {
		const auth = getFirebaseAuth();
		if (!auth.currentUser) return;
		const snap = await getDoc(doc(getDb(), "users", auth.currentUser.uid));
		if (snap.exists()) setProfile(snap.data() as UserProfile);
	}

	async function signUpWithEmail(email: string, password: string, displayName: string) {
		const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
		if (displayName) await updateProfile(cred.user, { displayName });
		await ensureProfile(cred.user);
	}

	async function signInWithEmail(email: string, password: string) {
		await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
	}

	async function logout() {
		await signOut(getFirebaseAuth());
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				profile,
				loading,
				signUpWithEmail,
				signInWithEmail,
				logout,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
	return ctx;
}
