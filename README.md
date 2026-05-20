# TEC — Trat English Community

Marketing site for **Trat English Community (TEC)**, a private language school in Trat, Thailand teaching English, Thai (for non-Thais), and Chinese to children aged 3–15.

**Live site:** https://tecschool.org

## Structure

Plain HTML / CSS / JS — no build step. Each language page is a single self-contained file.

```
/                # Home page (T·E·C language picker)
/english/        # English school landing page (the polished one)
/thai/           # Thai for non-Thais — coming soon placeholder
/chinese/        # Chinese for kids — coming soon placeholder
/assets/         # Images, videos, level photos, icons
```

## Preview locally

```bash
bunx serve -l 5173 .
# → http://localhost:5173/
```

Each HTML page has inline `<style>` and `<script>` — edit and reload (use `?v=N` to bust cache).

## Owner

Damien Herlihy · tratenglish@gmail.com
