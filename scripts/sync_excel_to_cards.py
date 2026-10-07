#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_excel_to_cards.py
- src/data/roguelike-cards.xlsx 파일을 읽어 게임 엔진용 src/data/roguelike-cards.json 파일로 자동 변환/동기화합니다.
- 기획자가 엑셀에서 수치, 텍스트, 드롭다운 옵션을 수정한 후 본 스크립트를 실행하면 인게임에 즉시 반영됩니다.
"""

import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import openpyxl

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.json')
EXCEL_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.xlsx')

def sync_excel_to_json():
    if not os.path.exists(EXCEL_PATH):
        print(f"❌ [에러] 엑셀 파일을 찾을 수 없습니다: {EXCEL_PATH}")
        sys.exit(1)

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb['RoguelikeCards'] if 'RoguelikeCards' in wb.sheetnames else wb.active

    cards = []

    # 2행부터 데이터 읽기
    for row_idx in range(2, ws.max_row + 1):
        card_id = ws.cell(row=row_idx, column=1).value
        if not card_id:
            continue
        card_id = str(card_id).strip()
        if not card_id:
            continue

        title = str(ws.cell(row=row_idx, column=2).value or '').strip()
        icon = str(ws.cell(row=row_idx, column=3).value or '').strip()
        rarity = str(ws.cell(row=row_idx, column=4).value or 'common').strip()
        build = str(ws.cell(row=row_idx, column=5).value or 'rapid').strip()
        
        max_stack_val = ws.cell(row=row_idx, column=6).value
        try:
            max_stack = int(max_stack_val) if max_stack_val is not None else 1
        except (ValueError, TypeError):
            max_stack = 1

        desc = str(ws.cell(row=row_idx, column=7).value or '').strip()

        # Stats 파싱
        stats = {}
        stat_cols = [
            (8, 'sp'),
            (9, 'haste'),
            (10, 'crit'),
            (11, 'critDmg'),
            (12, 'goldBonus')
        ]
        for col_idx, stat_key in stat_cols:
            val = ws.cell(row=row_idx, column=col_idx).value
            if val is not None and str(val).strip() != '':
                try:
                    num_val = float(val)
                    stats[stat_key] = int(num_val) if num_val.is_integer() else num_val
                except (ValueError, TypeError):
                    pass

        card = {
            "id": card_id,
            "title": title,
            "icon": icon,
            "rarity": rarity,
            "build": build,
            "maxStack": max_stack,
            "desc": desc
        }

        if stats:
            card["stats"] = stats

        prereq = ws.cell(row=row_idx, column=13).value
        if prereq and str(prereq).strip():
            card["prerequisite"] = str(prereq).strip()

        spell_key = ws.cell(row=row_idx, column=14).value
        if spell_key and str(spell_key).strip():
            card["spellKey"] = str(spell_key).strip()

        mechanic = ws.cell(row=row_idx, column=15).value
        if mechanic and str(mechanic).strip():
            card["mechanic"] = str(mechanic).strip()

        mech_params_val = ws.cell(row=row_idx, column=16).value
        if mech_params_val and str(mech_params_val).strip():
            try:
                card["mechanicParams"] = json.loads(str(mech_params_val).strip())
            except json.JSONDecodeError:
                pass

        cards.append(card)

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"✨ [동기화 성공] 엑셀({EXCEL_PATH}) ➔ JSON({JSON_PATH})")
    print(f"   총 {len(cards)}종의 파워업 카드가 성공적으로 업데이트되었습니다.")
    print(f"   브라우저에서 새로고침(F5)을 누르면 즉시 게임에 반영됩니다.")

if __name__ == "__main__":
    sync_excel_to_json()
