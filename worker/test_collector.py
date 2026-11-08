"""Smoke tests for source parsing; no live network required."""
import unittest
from datetime import date
from collector import parse_day, parse_catalog, parse_lessons


class CollectorTests(unittest.TestCase):
    def test_new_year(self):
        self.assertEqual(parse_day('05 января', date(2026, 12, 5)), '2027-01-05')
        self.assertEqual(parse_day('13 ноября', date(2026, 11, 8)), '2026-11-13')

    def test_catalog(self):
        html = '''<select name="group_name"><option value="">Группа</option><option value="ДГ-304">ДГ-304</option></select>
        <select name="teacher_search"><option value="147">Иванова М. М.</option></select>
        <select name="kab_stud"><option value="-1">Кабинет</option><option value="ГУК: 234">ГУК: 234</option></select>
        <select name="kab_prep"><option value="ГУК: 234">ГУК: 234</option></select>'''
        rows = parse_catalog(html)
        self.assertEqual(len(rows), 3)
        self.assertEqual(len([x for x in rows if x['kind'] == 'room']), 1)

    def test_lesson(self):
        html = '''<div class="rasp-item"><span class="rasp-day">13 ноября</span><div class="rasp-para">
        <span class="para-time">16:00 - 17:30</span><div class="rasp-desc"><p>Графика (Лекции)<br>
        ГУК: 214<br>Преподаватель: Иванова М. М.<br>Группа: ДГ-304</p></div></div></div>
        <script>Расписание обновлено 06.11.2026 в 16:47:51</script>'''
        rows, stamp = parse_lessons(html, date(2026,11,8))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['room'], 'ГУК: 214')
        self.assertEqual(rows[0]['type'], 'Лекции')
        self.assertIn('06.11.2026', stamp)

    def test_parallel_subgroups_from_html_comments(self):
        html = '''<div class="rasp-item"><span class="rasp-day">09 ноября</span>
        <div class="rasp-para"><span class="para-time">10:15 - 11:45</span>
        <div class="rasp-desc"><p>Иностранный язык (Практ.зан-я)<br>
        <span><!--Подгруппа: 1<br>-->ГУК: 301<br>Преподаватель: Иванова Анна Сергеевна<br>
        Группа: ДГ-304</span></p></div></div>
        <div class="rasp-para"><span class="para-time">10:15 - 11:45</span>
        <div class="rasp-desc"><p>Иностранный язык (Практ.зан-я)<br>
        <span><!--Подгруппа: 2<br>-->ГУК: 303<br>Преподаватель: Иванова Анна Сергеевна<br>
        Группа: ДГ-304</span></p></div></div></div>'''
        rows, _ = parse_lessons(html, date(2026, 11, 8))
        self.assertEqual(len(rows), 2)
        self.assertEqual([r['subgroup'] for r in rows], ['1', '2'])
        self.assertEqual([r['room'] for r in rows], ['ГУК: 301', 'ГУК: 303'])

    def test_subgroup_zero_does_not_add_a_label(self):
        html = '''<div class="rasp-item"><span class="rasp-day">09 ноября</span>
        <div class="rasp-para"><span class="para-time">10:15 - 11:45</span>
        <div class="rasp-desc">Графика (Лекции)<br><span><!--Подгруппа: 0<br>-->ГУК: 301</span></div>
        </div></div>'''
        rows, _ = parse_lessons(html, date(2026,11,8))
        self.assertEqual(rows[0]['subgroup'], '')


if __name__ == '__main__':
    unittest.main()
