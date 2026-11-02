from pathlib import Path
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/check_invariants.py'
spec = importlib.util.spec_from_file_location('guard', SCRIPT)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class InvariantsTests(unittest.TestCase):
    def test_plain_edit(self):
        r = guard.compare('Важно отметить: продажи снизились на 8%.', 'Продажи снизились на 8%.')
        self.assertFalse(r['differences'])
        self.assertIs(r['semantic_equivalence_verified'], False)

    def test_changed_number(self):
        self.assertIn('numbers', guard.compare('8%', '9%')['differences'])

    def test_number_occurrences(self):
        self.assertIn('numbers', guard.compare('8% и 8%', '8%')['differences'])

    def test_thousands_spaces(self):
        self.assertFalse(guard.compare('3 000 м²', '3\u00a0000 м²')['differences'])

    def test_signed_number(self):
        self.assertIn('numbers', guard.compare('−8%', '8%')['differences'])

    def test_percent_points(self):
        self.assertIn('units', guard.compare('на 2 п. п.', 'на 2%')['differences'])

    def test_bound_with_lock(self):
        r = guard.compare('более 3 000 м²', '3 000 м²', ['более 3 000 м²'])
        self.assertIn('locked_fragments', r['differences'])

    def test_negation_with_lock(self):
        self.assertIn('locked_fragments', guard.compare('не подтверждено', 'подтверждено', ['не подтверждено'])['differences'])

    def test_missing_lock_is_error(self):
        with self.assertRaises(ValueError):
            guard.compare('текст', 'текст', ['отсутствует'])

    def test_duplicate_lock_is_error(self):
        with self.assertRaises(ValueError):
            guard.compare('текст', 'текст', ['текст', 'текст'])

    def test_code_unchanged(self):
        self.assertFalse(guard.compare('Запуск: `python a.py --n 2`.', 'Выполните `python a.py --n 2`.')['differences'])

    def test_code_changed(self):
        self.assertIn('inline_code', guard.compare('`run --flag`', '`run —flag`')['differences'])

    def test_fenced_code(self):
        a = '```py\nx = True\n```\n'
        b = '```py\nx = False\n```\n'
        self.assertIn('fenced_code', guard.compare(a, b)['differences'])

    def test_tilde_fence(self):
        self.assertIn('fenced_code', guard.compare('~~~\na\n~~~\n', '~~~\nb\n~~~\n')['differences'])

    def test_table(self):
        a = '| Группа | Доля |\n|---|---|\n| А | 20% |\n| Б | 30% |\n'
        b = a.replace('| А | 20%', '| Б | 20%').replace('| Б | 30%', '| А | 30%')
        self.assertIn('markdown_tables', guard.compare(a, b)['differences'])

    def test_url_parameter(self):
        self.assertIn('urls', guard.compare('https://example.org/?id=one', 'https://example.org/?id=two')['differences'])

    def test_citation(self):
        self.assertIn('citations', guard.compare('Тезис :contentReference[oaicite:2].', 'Тезис.')['differences'])

    def test_semantic_blind_spot_is_not_success(self):
        r = guard.compare('Алексей поручил Борису проверку.', 'Борис поручил Алексею проверку.')
        self.assertFalse(r['differences'])
        self.assertIs(r['semantic_equivalence_verified'], False)

    def test_cli_read_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            p, q = Path(tmp)/'before.txt', Path(tmp)/'after.txt'
            p.write_text('8%', encoding='utf-8'); q.write_text('9%', encoding='utf-8')
            result = subprocess.run([sys.executable, str(SCRIPT), str(p), str(q)], capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(result.returncode, 1)
            self.assertFalse(json.loads(result.stdout)['semantic_equivalence_verified'])
            self.assertEqual(p.read_text(encoding='utf-8'), '8%')
            self.assertEqual(q.read_text(encoding='utf-8'), '9%')

    def test_cli_input_error(self):
        result = subprocess.run([sys.executable, str(SCRIPT), '/path/does/not/exist', '/path/no'], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stderr)['status'], 'input_error')


class PackageTests(unittest.TestCase):
    def test_frontmatter(self):
        text = (ROOT/'SKILL.md').read_text(encoding='utf-8')
        self.assertTrue(text.startswith('---\n'))
        head = text.split('---', 2)[1]
        name = re.search(r'^name: (.+)$', head, re.M)[1]
        self.assertRegex(name, r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
        self.assertEqual(name, 'text-editor-ru')
        self.assertLessEqual(len(name), 64)
        self.assertIn('description:', head)
        self.assertLess(len(text.splitlines()), 500)

    def test_relative_links(self):
        for path in ROOT.rglob('*.md'):
            for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
                if '://' not in target and not target.startswith('#'):
                    self.assertTrue((path.parent/target.split('#')[0]).exists(), f'{path}: {target}')

    def test_scenarios(self):
        cases = json.loads((ROOT/'eval/cases.json').read_text(encoding='utf-8'))
        self.assertEqual(len(cases), 18)
        self.assertEqual(len(cases), len({c['id'] for c in cases}))
        for c in cases:
            self.assertTrue(c['must']); self.assertTrue(c['must_not'])

    def test_version(self):
        self.assertIn('1.0.0', (ROOT/'SKILL.md').read_text(encoding='utf-8'))
        self.assertIn('1.0.0', (ROOT/'CHANGELOG.md').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
