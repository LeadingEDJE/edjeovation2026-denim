import { type InputHTMLAttributes, useId } from "react";
import { cn } from "../utils/cn";

export interface TextFieldProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	/** Uppercase field label rendered above the input. */
	label?: string;
	/** Error message; when set, the field renders in the invalid (sale-red) state. */
	error?: string;
	/** Quiet helper text shown below the input when there is no error. */
	hint?: string;
}

/**
 * A single-line text input with a tracked uppercase label, square border, and
 * navy focus state. Pass `error` to surface validation; `hint` for guidance.
 */
export function TextField({
	label,
	error,
	hint,
	className,
	id,
	...rest
}: TextFieldProps) {
	const autoId = useId();
	const fieldId = id ?? autoId;
	const invalid = Boolean(error);
	return (
		<div className={cn("flex flex-col gap-2 font-body", className)}>
			{label && (
				<label
					className="font-bold text-2xs text-ink uppercase tracking-label"
					htmlFor={fieldId}
				>
					{label}
				</label>
			)}
			<input
				id={fieldId}
				className={cn(
					"min-h-[44px] rounded-none border bg-white px-4 py-3 font-body text-ink text-sm transition-colors placeholder:text-muted focus:outline-none",
					invalid
						? "border-sale focus:border-sale"
						: "border-line focus:border-ink",
				)}
				aria-invalid={invalid}
				{...rest}
			/>
			{error ? (
				<span className="text-2xs text-sale">{error}</span>
			) : hint ? (
				<span className="text-2xs text-muted">{hint}</span>
			) : null}
		</div>
	);
}
