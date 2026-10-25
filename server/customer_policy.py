"""Isolate policy edits to a single customer's existing member note."""


def note_parts(policy: str, name: str) -> tuple[str, str, str]:
    lines = policy.splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines) if line.startswith(f"- {name}:")]
    if len(matches) != 1:
        raise ValueError("Customer policy note is missing or ambiguous; update the policy and rerun the review.")
    start = matches[0]
    end = start + 1
    while end < len(lines) and lines[end].startswith((" ", "\t")):
        end += 1
    return "".join(lines[:start]), "".join(lines[start:end]), "".join(lines[end:])


def proposal_notes(base: str, proposed: str, name: str) -> tuple[str, str]:
    before, old, after = note_parts(base, name)
    new_before, new, new_after = note_parts(proposed, name)
    if (before, after) != (new_before, new_after):
        raise ValueError("The proposal changed shared guidance or another customer; rerun this review.")
    return old, new


def apply_note(current: str, name: str, old: str, new: str) -> str:
    before, actual, after = note_parts(current, name)
    if actual != old:
        raise ValueError("This customer's policy changed since the review; run a new review.")
    return before + new + after
