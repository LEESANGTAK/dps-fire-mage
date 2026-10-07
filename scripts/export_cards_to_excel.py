#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_cards_to_excel.py
- src/data/roguelike-cards.json 데이터를 읽어 드롭다운(Data Validation)이 포함된 엑셀 파일(src/data/roguelike-cards.xlsx)로 생성합니다.
- 기획자가 엑셀에서 셀을 클릭하면 enum 드롭다운(▼)으로 희귀도, 빌드, 선행조건, 스킬키 등을 선택할 수 있습니다.
"""

import json
import os
import sys

# Windows cp949 콘솔 대비 utf-8 출력 설정
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.json')
EXCEL_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.xlsx')

def export_to_excel():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        cards = json.load(f)
        if isinstance(cards, dict) and 'cards' in cards:
            cards = cards['cards']

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RoguelikeCards"

    # 헤더 정의: (표시명, JSON 키 매핑, 열 너비)
    columns = [
        ("ID", "id", 20),
        ("이름", "title", 18),
        ("아이콘", "icon", 8),
        ("희귀도(rarity)", "rarity", 16),
        ("빌드(build)", "build", 14),
        ("최대중첩", "maxStack", 10),
        ("설명(desc)", "desc", 40),
        ("주문력(sp)", "stats.sp", 12),
        ("가속도(haste)", "stats.haste", 12),
        ("치명타(crit)", "stats.crit", 12),
        ("치명피해(critDmg)", "stats.critDmg", 14),
        ("골드보너스(goldBonus)", "stats.goldBonus", 16),
        ("선행조건(prerequisite)", "prerequisite", 22),
        ("해금스킬(spellKey)", "spellKey", 18),
        ("특수기믹(mechanic)", "mechanic", 22),
        ("기믹파라미터(JSON)", "mechanicParams", 20)
    ]

    header_font = Font(name="Malgun Gothic", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2A364F", end_color="2A364F", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    border_thin = Side(border_style="thin", color="CCCCCC")
    cell_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

    # 1. 헤더 작성
    for col_idx, (col_name, _, width) in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 28

    # 2. 데이터 행 작성
    row_font = Font(name="Malgun Gothic", size=10)
    for row_idx, card in enumerate(cards, 2):
        ws.row_dimensions[row_idx].height = 22
        stats = card.get('stats', {}) or {}
        
        row_values = [
            card.get('id', ''),
            card.get('title', ''),
            card.get('icon', ''),
            card.get('rarity', 'common'),
            card.get('build', 'rapid'),
            card.get('maxStack', 1),
            card.get('desc', ''),
            stats.get('sp', ''),
            stats.get('haste', ''),
            stats.get('crit', ''),
            stats.get('critDmg', ''),
            stats.get('goldBonus', ''),
            card.get('prerequisite', ''),
            card.get('spellKey', ''),
            card.get('mechanic', ''),
            json.dumps(card.get('mechanicParams', {}), ensure_ascii=False) if card.get('mechanicParams') else ''
        ]

        for col_idx, val in enumerate(row_values, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = row_font
            cell.border = cell_border
            # 정렬
            if col_idx in [3, 4, 5, 6, 8, 9, 10, 11, 12]:  # 아이콘, 희귀도, 빌드, 중첩, 스탯 등
                cell.alignment = center_align
            else:
                cell.alignment = left_align

    total_rows = len(cards) + 1

    # 3. 데이터 유효성 검사 (드롭다운 enum 설정)
    # (1) rarity 드롭다운 (D열 = col 4)
    dv_rarity = DataValidation(type="list", formula1='"common,rare,epic,legendary"', allow_blank=False)
    dv_rarity.error = "희귀도는 common, rare, epic, legendary 중에서 선택해주세요."
    dv_rarity.errorTitle = "유효하지 않은 희귀도"
    ws.add_data_validation(dv_rarity)
    dv_rarity.add(f"D2:D{total_rows + 50}")

    # (2) build 드롭다운 (E열 = col 5)
    dv_build = DataValidation(type="list", formula1='"rapid,crit,pet,util,spell"', allow_blank=False)
    dv_build.error = "빌드는 rapid, crit, pet, util, spell 중에서 선택해주세요."
    dv_build.errorTitle = "유효하지 않은 빌드"
    ws.add_data_validation(dv_build)
    dv_build.add(f"E2:E{total_rows + 50}")

    # (3) prerequisite 드롭다운 (M열 = col 13)
    dv_prereq = DataValidation(type="list", formula1='"has_summon,has_meteor,has_combustion,has_fireblast,has_ice_barrier"', allow_blank=True)
    dv_prereq.error = "선행조건 목록에서 선택하거나 빈칸으로 두세요."
    dv_prereq.errorTitle = "유효하지 않은 선행조건"
    ws.add_data_validation(dv_prereq)
    dv_prereq.add(f"M2:M{total_rows + 50}")

    # (4) spellKey 드롭다운 (N열 = col 14)
    dv_spell = DataValidation(type="list", formula1='"fireblast,meteor,combustion,summon,ice_barrier"', allow_blank=True)
    dv_spell.error = "해금스킬 키 목록에서 선택하거나 빈칸으로 두세요."
    dv_spell.errorTitle = "유효하지 않은 스킬 키"
    ws.add_data_validation(dv_spell)
    dv_spell.add(f"N2:N{total_rows + 50}")

    # (5) mechanic 드롭다운 (O열 = col 15)
    dv_mech = DataValidation(type="list", formula1='"scorch_multiplier,ignite_spread,phoenix_flame,phoenix_feather_boost,pyro_echo,mana_surge,alchemy_gold"', allow_blank=True)
    dv_mech.error = "특수기믹 키 목록에서 선택하거나 빈칸으로 두세요."
    dv_mech.errorTitle = "유효하지 않은 기믹 키"
    ws.add_data_validation(dv_mech)
    dv_mech.add(f"O2:O{total_rows + 50}")

    # 틀 고정 (헤더 고정)
    ws.freeze_panes = "A2"

    wb.save(EXCEL_PATH)
    print(f"✨ [성공] {len(cards)}종 카드를 드롭다운이 적용된 엑셀 파일로 내보냈습니다:")
    print(f"   -> {EXCEL_PATH}")

if __name__ == "__main__":
    export_to_excel()
