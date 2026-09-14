from dataclasses import dataclass

from app.services.code_repository import repository_diff


@dataclass(frozen=True, slots=True)
class CompletionValidation:
    valid: bool
    summary: str


def validate_coding_completion(
    original: dict[str, str], current: dict[str, str], verification_passed: bool
) -> CompletionValidation:
    if not repository_diff(original, current):
        return CompletionValidation(False, "Completion requires a non-empty repository change.")
    if not verification_passed:
        return CompletionValidation(
            False, "Completion requires passing deterministic verification."
        )
    return CompletionValidation(
        True, "Repository diff is non-empty and deterministic verification passed."
    )
