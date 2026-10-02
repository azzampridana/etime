import type { ActionResult } from "@/types/action-result";

export type LoginFailure = "INVALID_CREDENTIALS" | "INACTIVE_ACCOUNT" | "VALIDATION_ERROR" | "SYSTEM_ERROR";
export type LoginResult = ActionResult & { failure?: LoginFailure };
