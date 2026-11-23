# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


"""The complete part of a backup: every table of the system itself (people, roles, groups, the media library with its tags, licence, settings, pages, notifications ...) and every file in the storage
(pictures and videos of the library, photos and files of people, logos). The tables and files of plugins are in the section Plugins of settings.json.
Left out: sessions, logins (tokens), the log of the admin, the rights tables of Django, the table of the backups itself and of the plugins (the section Plugins does that), and the keys of the
API connections unless the backup is made with secrets."""
import io
import json
import logging

from django.apps import apps
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.db import connection, transaction

logger = logging.getLogger(__name__)
EXCLUDE = ["contenttypes", "auth.permission", "sessions", "authtoken", "admin.logentry", "backups", "plugins", "sandbox.demosettings", "sandbox.demouser", "sandbox.demoentity"]  # (the demo settings and demo users stay as they are when a backup is put back)
FILES = "files/"


def dump(include_secrets=False):
    """All tables of the system as one JSON text (Django dumpdata: every row with its id, so the links between rows stay as they are)."""
    buf = io.StringIO()
    call_command("dumpdata", exclude=EXCLUDE + ([] if include_secrets else ["integrations"]), stdout=buf, verbosity=0)
    return buf.getvalue()


def walk(base=""):
    """The names of all files in the storage."""
    dirs, files = default_storage.listdir(base)
    for f in files:
        yield f"{base}/{f}".lstrip("/")
    for d in dirs:
        yield from walk(f"{base}/{d}".lstrip("/"))


def files():
    """{zip path: bytes} for every file in the storage (a file that cannot be read is left out and listed). Returns (dict, skipped)."""
    out, skipped = {}, []
    for name in walk():
        try:
            with default_storage.open(name, "rb") as fh:
                out[FILES + name] = fh.read()
        except Exception:  # noqa: BLE001 - a missing or locked file must not stop the backup
            skipped.append(name)
    return out, skipped


def _heal(dumped_tables):
    """What is not in the backup (tables of plugins, logins, the list of backups) may still point at rows that are gone now: a link that may be empty is emptied, a row that needs the link goes
    (with the rows that need that row, a few rounds)."""
    with connection.cursor() as cur:
        intro = connection.introspection
        rels = {}
        for t in intro.table_names():
            nullable = {c.name: c.null_ok for c in intro.get_table_description(cur, t)}
            r = [(col, ref_t, ref_c, bool(nullable.get(col))) for col, (ref_c, ref_t) in intro.get_relations(cur, t).items()]
            if r:
                rels[t] = r
        for _round in range(4):
            for t, r in rels.items():
                for col, ref_t, ref_c, null in r:
                    cond = f'"{col}" IS NOT NULL AND "{col}" NOT IN (SELECT "{ref_c}" FROM "{ref_t}")'
                    if null:
                        cur.execute(f'UPDATE "{t}" SET "{col}" = NULL WHERE {cond}')
                    else:
                        cur.execute(f'DELETE FROM "{t}" WHERE {cond}')


def load(raw, only=None, skip=None):
    """Put the tables back: what is in the backup replaces what is in these tables now (the rows are given their old id again). Returns the number of rows."""
    import os
    import tempfile

    rows = json.loads(raw)
    if only:  # only the tables of these models (e.g. the licence)
        rows = [r for r in rows if r["model"] in only]
    if skip:  # everything except these models
        rows = [r for r in rows if r["model"] not in skip]
    labels = []
    for r in rows:
        if r["model"] not in labels:
            labels.append(r["model"])
        r["fields"].pop("user_permissions", None)  # (the ids of the rights of Django differ per installation; this system has its own roles)
    raw = json.dumps(rows)
    models = [apps.get_model(label) for label in labels]
    through = []  # the tables of many-to-many links of these models: they are filled again with the rows
    for m in models:
        for f in m._meta.local_many_to_many:
            if f.remote_field.through._meta.auto_created:
                through.append(f.remote_field.through)
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    sqlite = connection.vendor == "sqlite"
    if sqlite:
        with connection.cursor() as cur:
            cur.execute("PRAGMA foreign_keys = OFF")  # (only possible outside a transaction)
    try:
        with transaction.atomic():
            if connection.vendor == "postgresql":
                with connection.cursor() as cur:
                    cur.execute("SET CONSTRAINTS ALL DEFERRED")
            for m in through + list(reversed(models)):
                m._base_manager.all()._raw_delete(using=connection.alias)  # without the cascade of Django: the rows of the backup come back anyway
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(raw)
            call_command("loaddata", path, verbosity=0)  # (also puts the counters of the ids right)
            _heal({m._meta.db_table for m in models})
    finally:
        if sqlite:
            with connection.cursor() as cur:
                cur.execute("PRAGMA foreign_keys = ON")
        try:
            os.unlink(path)
        except OSError:
            pass
    return len(rows)


CREATOR_MODELS = {"core.sitedesignjob", "core.componentrequest"}  # the designs of the creator (files, chat, documents, translations) and its component requests


def creator_prefix():
    """Where the documents of the creator live in the storage (site/designs/...)."""
    from apps.medialib import areas

    return areas.site_path("designs").rstrip("/") + "/"


def restore_files(zf, prefix=None):
    """Every file of the backup back in the storage under its old name (with prefix: only the files under that folder). Returns the number of files."""
    n = 0
    for name in zf.namelist():
        if not name.startswith(FILES) or name.endswith("/"):
            continue
        key = name[len(FILES):]
        if prefix and not key.startswith(prefix):
            continue
        if default_storage.exists(key):
            default_storage.delete(key)
        default_storage.save(key, ContentFile(zf.read(name)))
        n += 1
    return n
