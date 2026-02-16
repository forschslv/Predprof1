from docx_utils import generate_table_setting_report

if __name__ == '__main__':
    data = [
        {'user_name': 'Иванов Иван', 'dishes': ['Борщ', 'Котлета', 'Котлета'], 'total': 250.0},
        {'user_name': 'Петров Петр', 'dishes': ['Салат', 'Хлеб'], 'total': 120.5},
    ]
    path = generate_table_setting_report(data, filename='Test_Report.docx', period='За период: 2026-02-01 — 2026-02-16', grand_total=370.5)
    print('Generated:', path)

