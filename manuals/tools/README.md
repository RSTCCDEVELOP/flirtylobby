# Manual tools

The manual (English) is made with the AI and has screenshots. Everything is in `manuals/`:

- `pdf/manual_en.pdf` and `html/en/` (the HTML manual, served by the backend at `/api/manual/html/`), screenshots in `html/en/images/`
- `src/chapters_en.json`: the texts of the chapters (written by the AI)
- `tools/shots.json`: the list of screenshots (page, chapter, caption, steps)

Make or update (run from `backend/` with the venv; the site must run: backend https://localhost:8000, frontend https://localhost:5173):

1. Texts of the interface in English (so the pictures are in English): `python manage.py shell -c "exec(open('../manuals/tools/fill_en.py').read())"`
2. Screenshots: `SHOTS_ARGS="--refresh" python manage.py shell -c "exec(open('../manuals/tools/shoot.py').read())"`
   (`--only id,id` for a few; without `--refresh` only missing ones.) A temporary superadmin is used and removed; all modules and plugins are switched on for a moment and put back.
3. Manual: `python manage.py shell -c "exec(open('../manuals/tools/make_manual.py').read())"` (AI writes the chapters; `MANUAL_REUSE=1` reuses `src/chapters_en.json`, no AI).
