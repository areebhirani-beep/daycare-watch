"""Deterministic classification of Texas child-care violations.

Two pure functions feed the parent-facing app:

* ``categorize`` maps a cited standard (e.g. ``"746.1601 - Child/ Caregiver Ratio"``) to one of a
  few plain topics, using an ordered rule table: the standard number decides first, title
  keywords second, and broad rule-chapter ranges last.
* ``plain_summary`` shortens an inspector narrative to one plain sentence. It only removes text,
  fixes whitespace/casing and swaps a few fixed jargon phrases; it never adds facts.
"""

from __future__ import annotations

import re
from typing import Literal, NamedTuple

Category = Literal[
    "supervision",
    "background_checks",
    "staff_ratio",
    "safety_hazards",
    "health_medication",
    "discipline",
    "parent_communication",
    "paperwork_admin",
    "other",
]

# --------------------------------------------------------------------------------------------
# parse_standard
# --------------------------------------------------------------------------------------------

# The state's export turns an apostrophe into "?" ("child?s", "don?t").
_LOST_APOSTROPHE = r"(?<=[A-Za-z])\?(?=(?:s|t)\b)"

_STANDARD_RE = re.compile(
    r"^\s*(?P<code>(?:HRC\s*(?:Sec\.\s*)?)?\d[\d ]*\.\d+(?:\s*\([^)]*\))*)\s*(?:-\s*)?(?P<title>.*)$",
    re.IGNORECASE | re.DOTALL,
)


def parse_standard(desc: str) -> tuple[str, str]:
    """Split ``"746.1201(1) - Title"`` into ``("746.1201(1)", "Title")``.

    Codes are compacted (``"HRC 42.0563"`` -> ``"HRC42.0563"``, ``"74 7.1327"`` -> ``"747.1327"``).
    Text without a recognizable code returns ``("", text)``.
    """
    match = _STANDARD_RE.match(desc)
    if match is None:
        return "", " ".join(desc.split())
    code = re.sub(r"\s+|Sec\.", "", match["code"], flags=re.IGNORECASE)
    code = re.sub(r"^hrc", "HRC", code, flags=re.IGNORECASE)
    return code, re.sub(_LOST_APOSTROPHE, "'", " ".join(match["title"].split()))


# --------------------------------------------------------------------------------------------
# categorize
# --------------------------------------------------------------------------------------------


class Rule(NamedTuple):
    field: Literal["code", "title"]
    pattern: re.Pattern[str]
    category: Category
    reason: str


def _code(pattern: str, category: Category, reason: str) -> Rule:
    return Rule("code", re.compile(pattern), category, reason)


def _title(pattern: str, category: Category, reason: str) -> Rule:
    return Rule("title", re.compile(pattern, re.IGNORECASE), category, reason)


# Order matters: the first matching rule wins.
RULES: tuple[Rule, ...] = (
    # 1. Standard number: sections whose topic is unambiguous.
    _code(r"^745\.6\d\d\b", "background_checks", "26 TAC 745 subchapter F: background checks"),
    _code(r"^745\.41\d\d\b", "background_checks", "26 TAC 745: mandatory staff drug testing"),
    _code(r"^HRC42\.056\b", "background_checks", "HRC 42.056: background checks"),
    _code(
        r"^HRC42\.04271\b|^74[467]\.(?:307|70\d)\b",
        "parent_communication",
        "Parent rights, parent notification, incident forms for parents",
    ),
    _code(
        r"^74[467]\.30\d\b|^745\.|^HRC",
        "paperwork_admin",
        "Reports to Licensing; 26 TAC 745 and HRC permit, fee and inspection rules",
    ),
    _code(
        r"^(?:744\.1[5-7]|746\.1[5-9]|746\.21|747\.1[6-9]|747\.20)\d\d\b",
        "staff_ratio",
        "Ratio and group-size subchapters",
    ),
    _code(r"^(?:744\.21|746\.28|747\.27|742\.6)\d\d\b", "discipline", "Discipline and guidance subchapters"),
    _code(r"^(?:744\.12|746\.12|747\.15)\d\d\b", "supervision", "Caregiver responsibilities and supervision"),
    # 2. Title keywords, most specific first.
    _title(
        r"background|criminal history|fingerprint|(?:pre-employment|home) screening|drug test",
        "background_checks",
        "Background, fingerprint, pre-employment screening",
    ),
    _title(r"\bratios?\b|group size|capacity", "staff_ratio", "Child-to-caregiver ratio or capacity"),
    _title(
        r"punish|disciplin|restrain|behavior intervention|\bEBI\b|belittle|demean|ridicule",
        "discipline",
        "Discipline, punishment, restraint",
    ),
    _title(
        r"supervis|caregiver responsib|responsibilities of (?:employees|caregivers)"
        r"|employee (?:and caregiver |general )?responsib|release of children|abuse|neglect",
        "supervision",
        "Supervision, caregiver duties, protection from abuse",
    ),
    _title(
        r"parent'?s? rights|notify parents|notif\w* (?:to |of )?parents?|parental (?:communication|notif)"
        r"|shar\w* with parent|contact parent|provide parents|permission|notice to the parent",
        "parent_communication",
        "Telling parents, parent permission, parent rights",
    ),
    _title(r"train|orientation|pre-service|clock hours", "paperwork_admin", "Staff training hours"),
    _title(r"polic|posting (?:requirements|of)", "paperwork_admin", "Written policies and required postings"),
    _title(
        r"fire|smoke|extinguish|carbon monoxide|\bgas\b|drill|evacuat|lock-?down|toxic|chemical|poison"
        r"|product|cpsc|sleep|swaddl|\bcribs?\b|restrictive device|\bnap",
        "safety_hazards",
        "Fire, emergency drills, toxic materials, product recalls, infant sleep",
    ),
    _title(
        r"medicat|immuniz|vaccinat|health|\bill(?:ness)?\b|allerg|food|feeding|bottle|meal|menu|nutrition"
        r"|diaper|handwash|sanit|hygien|\bTB\b|medical|toilet|soap|tobacco|smoking|communicable"
        r"|critical injury|glove|bodily fluid|pest|vision|hearing",
        "health_medication",
        "Health, food, hygiene, medication",
    ),
    _title(
        r"record|documentation|document|affidavit|\bform\b|admission|report|notif|permit|licens"
        r"|insurance|\bfees?\b|franchise|qualification|director|certificat|complian|compl(?:y|ies)\b"
        r"|application|employees",
        "paperwork_admin",
        "Records, forms, reporting, licensing, staff qualifications",
    ),
    _title(
        r"hazard|safe|emergenc|shelter|water|pool|swim|wading|splash|sprinkler|\bplay|use zone|surfacing"
        r"|equipment|swing|slide|trampoline|fenc|\bgates?\b|vehicle|transport|alarm|electric|outlet|cleaning"
        r"|weapon|firearm|chok|strap|furnish|building|grounds|repair|mainten|lighting|ventilat|exit"
        r"|television|first aid|tools|space|\bcots?\b|\bbeds?\b|\bmats?\b|animal|bedroom|physical site",
        "safety_hazards",
        "Physical safety, equipment, playground, transportation",
    ),
    # 3. Rule-chapter ranges as a last resort.
    _code(r"^74[467]\.[3-9]\d\d\b|^74[467]\.1[0-4]\d\d\b", "paperwork_admin", "Administration subchapters"),
    _code(
        r"^(?:746\.(?:3[7-9]|[45]\d)|747\.(?:3[5-9]|[45]\d))\d\d\b",
        "safety_hazards",
        "Safety, equipment, fire and transportation subchapters",
    ),
)


def match_rule(standard_number_description: str) -> Rule | None:
    """Return the first rule that matches, or None (meaning "other")."""
    code, title = parse_standard(standard_number_description)
    for rule in RULES:
        if rule.pattern.search(code if rule.field == "code" else title):
            return rule
    return None


def categorize(standard_number_description: str) -> Category:
    rule = match_rule(standard_number_description)
    return "other" if rule is None else rule.category


# --------------------------------------------------------------------------------------------
# plain_summary
# --------------------------------------------------------------------------------------------

MAX_SUMMARY = 140
ELLIPSIS = "…"

# Some narratives lose the apostrophe to a space ("wasn t", "today s"). Possessives are repaired only for
# nouns that recur in the data, never for any word followed by a lone "s".
_SPACE_CONTRACTION = r"\b(wasn|weren|isn|aren|didn|doesn|don|hasn|haven|hadn|couldn|wouldn|shouldn|can|won) t\b"
_SPACE_POSSESSIVE = (
    r"\b(child|children|parent|school|caregiver|director|person|provider|daycare|physician|center|driver|today"
    r"|home|year|toddler|infant|program|nurse|employee|doctor|operation|staff|teacher|owner|month|week) s\b"
)

# Fixed de-jargon table. Replacements contain no digits and no names.
REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pattern, re.IGNORECASE), replacement)
    for pattern, replacement in (
        (_LOST_APOSTROPHE, "'"),  # "child?s" -> "child's"
        (_SPACE_CONTRACTION, r"\1't"),  # "wasn t" -> "wasn't"
        (_SPACE_POSSESSIVE, r"\1's"),  # "child s file" -> "child's file"
        (r"\b(the|this|that) operation's\b", r"\1 daycare's"),
        (r"\b(the|this|that) operation\b", r"\1 daycare"),
        (r"\bw/o\b", "without"),
        (r"\bw/\s*", "with "),
        (r"(?<=\d)\s?(?:yo|y/o)\b", "-year-old"),
        (r"(?<=\d)\s?yrs\b", " years"),
        (r"(?<=\d)\s?yr\b", " year"),
        (r"\byrs\b", "years"),
        (r"\byr\b", "year"),
        (r"\bhrs\b", "hours"),
        (r"\bapprox\.?(?=\s)", "approximately"),
        (r"\s&\s", " and "),
    )
)
REPLACEMENT_WORDS = frozenset(
    w for _, rep in REPLACEMENTS for w in re.findall(r"[a-z]+", rep.replace(r"\1", "").lower())
)

# Framing phrases that carry no finding; dropping them only shortens the inspector's sentence.
_LEAD_INS = re.compile(
    r"^(?:based on (?:the )?(?:information|evidence)[^,]{0,80}?(?:,\s*|\s+(?=evidence supports that)))?"
    r"(?:(?:at the time of|during|upon) (?:the |an |a |this )?(?:inspection|investigation|visit|review)\b"
    r"(?!\s*(?:of|conducted|on|at|by|in|for|from|with|dated)\b)\s*,?\s*)?"
    r"(?:it (?:was|is) (?:found|observed|determined|noted|discovered|revealed|confirmed)"
    r"(?: during (?:the|an|this) (?:inspection|investigation|visit|review)\b)?\s*,?\s*that\s+)?"
    r"(?:(?:there (?:was|is) (?:sufficient |enough )?evidence to (?:support|show|determine)|evidence supports)"
    r" that\s+)?",
    re.IGNORECASE,
)
# Sentences that only describe the review itself, not what was found.
_META = re.compile(
    r"^(?:this (?:standard|rule) (?:was|is) (?:evaluated|reviewed|assessed)\b"
    r"|an? (?:minimum )?standards? violation was found\.?$|[\w\s']{0,40}\b(?:was|were) reviewed\.$)",
    re.IGNORECASE,
)
# A sentence that only sets the scene ("Lunch was observed during today's inspection."). When one leads,
# the summary takes the first later sentence that states what was wrong.
_SCENE = re.compile(
    r"^[\w\s'\u2019,/-]{0,60}?\b(?:was|were) (?:observed|reviewed|checked|inspected|monitored|conducted|looked at)\s+"
    r"(?:during|at|on|while)\b[^.]{0,40}\b(?:inspection|visit|investigation|review)\.$",
    re.IGNORECASE,
)
_DEFICIENCY = re.compile(
    r"(?:n't|n t)\b|\b(?:not|no|never|without|fail(?:ed|s)?|missing|expired|need(?:ed|s)?|required|must"
    r"|lack(?:ed|ing|s)?|unable|insufficient|incomplete)\b",
    re.IGNORECASE,
)
_NO_SPLIT_AFTER = re.compile(r"(?:\b(?:Mr|Mrs|Ms|Dr|St|No|vs|approx|[ap]\.m)|\b[A-Z])\.$", re.IGNORECASE)
_SENTENCE_END = re.compile(r"[.!?](?=\s+\S)")


def _sentences(text: str) -> list[str]:
    """Split on sentence ends, skipping abbreviations and fragments under four words."""
    out, start = [], 0
    for match in _SENTENCE_END.finditer(text):
        head = text[start : match.end()].strip()
        if not _NO_SPLIT_AFTER.search(head) and len(head.split()) >= 4:
            out.append(head)
            start = match.end()
    tail = text[start:].strip()
    return [*out, tail] if tail else out


def _first_finding(text: str) -> str:
    sentences = _sentences(text)
    findings = [s for s in sentences if not _META.search(s)]
    if not findings:
        return sentences[0]
    if _SCENE.search(findings[0]):
        return next((s for s in findings[1:] if _DEFICIENCY.search(s)), findings[0])
    return findings[0]


def _truncate(text: str) -> str:
    if len(text) <= MAX_SUMMARY:
        return text
    room = text[: MAX_SUMMARY - len(ELLIPSIS) + 1]
    cut = room.rfind(" ")
    if cut <= 0:  # one giant token: back off to the start of the last word-ish run
        cut = len(re.sub(r"[\w.:/-]*$", "", room[:-1]))
    clause = max(room.rfind(", ", 0, cut + 1), room.rfind("; ", 0, cut + 1))
    if clause >= MAX_SUMMARY - 30:  # prefer a clause end only when it costs few words
        cut = clause
    head = room[:cut].rstrip(" ,;:-")
    return head + ELLIPSIS if head else ""


def plain_summary(narrative: str | None) -> str | None:
    """One plain sentence (<= 140 chars) built only from the inspector's own words."""
    if narrative is None or not narrative.strip():
        return None
    text = " ".join(narrative.split())
    if text.upper() == text and any(c.isalpha() for c in text):
        text = re.sub(r"\bi\b", "I", text.lower())
    text = _first_finding(text)
    text = _LEAD_INS.sub("", text, count=1) or text
    for pattern, replacement in REPLACEMENTS:
        text = pattern.sub(replacement, text)
    text = _truncate(" ".join(text.split()))
    if not text:
        return None
    if "a" <= text[0] <= "z":
        text = text[0].upper() + text[1:]
    return text
