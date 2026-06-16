# DNS Rotonda fonts

Add the following font files to this directory (exact file names):

- `DNS RotondaC.ttf` (Regular, 400)
- `DNS RotondaC-Bold.ttf` (Bold, 700)
- `DNS RotondaC-Black.ttf` (Black, 900)

These files are referenced by `client/src/index.css` via `/fonts/...` URLs.
If they are missing, the app will fall back to `Inter/system-ui`, and Vite may print non-blocking warnings during build.
