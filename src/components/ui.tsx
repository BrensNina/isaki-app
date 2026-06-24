"use client";

// Primitivos de UI compartidos. Sistema visual: tema claro, superficies blancas
// sobre lienzo gris suave, marca índigo, esquinas redondeadas y sombras sutiles.
// Sin gradientes ni emojis; los íconos provienen de lucide-react.

import { Loader2, X } from "lucide-react";
import type {
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";

/** Une clases ignorando valores vacíos/falsos. */
export function cn(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(" ");
}

const FIELD =
	"h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn("rounded-xl border border-border bg-surface p-6 shadow-sm", className)}>
			{children}
		</div>
	);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
	const variants = {
		primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
		secondary: "border border-border bg-surface text-foreground hover:bg-background",
		ghost: "text-muted hover:bg-background hover:text-foreground",
		danger: "border border-red-200 text-red-600 hover:bg-red-50",
	};
	return (
		<button
			{...props}
			className={cn(
				"inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
				variants[variant],
				className,
			)}
		/>
	);
}

export function Field({
	label,
	hint,
	error,
	children,
}: {
	label: string;
	hint?: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-sm font-medium text-foreground">{label}</span>
			{children}
			{hint && !error && <span className="text-xs text-muted">{hint}</span>}
			{error && <span className="text-xs text-red-600">{error}</span>}
		</label>
	);
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} className={cn(FIELD, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select {...props} className={cn(FIELD, "cursor-pointer", className)}>
			{children}
		</select>
	);
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			{...props}
			className={cn(
				"w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none resize-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
				className,
			)}
		/>
	);
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				className,
			)}
		>
			{children}
		</span>
	);
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
	return (
		<div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
			<Loader2 className="h-4 w-4 animate-spin" />
			{label}
		</div>
	);
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
	return (
		<div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
			{icon && <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted">{icon}</div>}
			<p className="text-sm font-medium text-foreground">{title}</p>
			{hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
		</div>
	);
}

/** Diálogo modal centrado con fondo oscurecido. */
export function Modal({
	title,
	onClose,
	children,
	wide,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
	wide?: boolean;
}) {
	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className={cn(
					"w-full rounded-2xl border border-border bg-surface shadow-2xl max-h-[92vh] overflow-y-auto",
					wide ? "max-w-2xl" : "max-w-md",
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
					<h2 className="text-base font-semibold">{title}</h2>
					<button
						onClick={onClose}
						className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-background hover:text-foreground"
						aria-label="Cerrar"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div className="p-6">{children}</div>
			</div>
		</div>
	);
}

/** Formatea un número como moneda (soles peruanos). */
export function money(n: number): string {
	return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);
}
