# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A strong password that is easy to type, in the format of Apple: three groups of six letters (consonant, vowel, consonant, consonant, vowel, consonant), one digit and one capital
somewhere in it, for example tuntod-jeznyt-6kukmY. 20 characters. The same generator is in frontend/lib/password.js: use one of them wherever a password is made."""
import secrets

CONS = "bcdfghjkmnpqrstvwxz"
VOWELS = "aeiouy"
GROUPS = 3


def generate():
    chars = []
    for _ in range(GROUPS):
        for part in range(6):
            chars.append(secrets.choice(VOWELS if part in (1, 4) else CONS))
    i = secrets.randbelow(len(chars))
    j = secrets.choice([k for k in range(len(chars)) if k != i])
    chars[i] = str(secrets.randbelow(10))
    chars[j] = chars[j].upper()
    return "-".join("".join(chars[g * 6:(g + 1) * 6]) for g in range(GROUPS))
