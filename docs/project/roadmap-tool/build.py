"""Сборка страницы дорожной карты из template.html.
Запуск из этой папки:  python3 build.py
Результат: page.html (для публикации) и dorozhnaya-karta-offline.html (один файл, работает без сети)."""
import re, pathlib
d = pathlib.Path(__file__).parent
t = (d / 'template.html').read_text(encoding='utf-8')
logo = (d / 'mark.b64').read_text().strip()
page = t.replace('__LOGO__', logo)
(d / 'page.html').write_text(page, encoding='utf-8')
off = re.sub(r'<link [^>]*>\n?', '', page)
title = re.search(r'<title>.*?</title>', off).group(0)
off = off.replace(title, '', 1).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
doc = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" '
       'content="width=device-width,initial-scale=1,viewport-fit=cover">' + title +
       '<style>html{-webkit-text-size-adjust:100%}body{margin:0}</style></head><body>\n' + off + '\n</body></html>\n')
(d / 'dorozhnaya-karta-offline.html').write_text(doc, encoding='utf-8')
print('page.html', len(page), '| offline', len(doc))
