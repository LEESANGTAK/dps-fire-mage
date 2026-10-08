#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_cards_to_excel.py
- src/data/roguelike-cards.json 데이터를 읽어 드롭다운(Data Validation)과 설명서/툴팁이 포함된 엑셀 파일(src/data/roguelike-cards.xlsx)로 생성합니다.
- 열 구성·드롭다운 enum·가이드북 내용은 scripts/card_columns.py에서 정의합니다.
- 기능:
  1) 각 셀을 클릭할 때마다 엑셀 입력 메시지(설명 툴팁 말풍선) 자동 팝업
  2) 헤더(1행) 셀마다 상세 안내 메모(Comment) 부착
  3) enum 드롭다운(▼) 지원: rarity, build, prerequisite, spellKey, mechanic
  4) Sheet 2: [📖 옵션_도움말_가이드] 종합 기획 가이드북 탭 제공
  5) 기존 엑셀이 같은 열 구성이면 기획자가 지정한 열 너비·희귀도 배경색을 보존
"""

import json
import os
import sys
from copy import copy

# Windows cp949 콘솔 대비 utf-8 출력 설정
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from card_columns import CARD_COLUMNS, ENUMS, GUIDE_SECTIONS, GUIDE_COL_WIDTHS  # noqa: E402

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.json')
EXCEL_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.xlsx')
GUIDE_SHEET = "📖 옵션_도움말_가이드"

# 드롭다운 안내 문구 (열 키 → (제목, 안내))
DROPDOWN_PROMPTS = {
    "rarity": ("[희귀도(rarity) 옵션 안내]", "• common: 일반\n• rare: 희귀\n• legendary: 전설 (보스전 우대)"),
    "build": ("[빌드(build) 분류 안내]", "• rapid: 속사 머신건\n• crit: 극치명 누킹\n• summon: 정령 군단\n• burn: 연소 지대\n• utility: 유틸리티"),
    "prerequisite": ("[선행조건(prerequisite) 안내]", "조건을 달성해야 3지선다에 등장합니다.\n빈칸이면 조건 없이 항상 등장합니다."),
    "spellKey": ("[해금스킬(spellKey) 안내]", "• fireblast: 불꽃 작렬\n• meteor: 메테오\n• combustion: 마력 폭주\n• flame_patch: 불장판"),
    "mechanic": ("[특수기믹(mechanic) 안내]", "시스템 특수 로직 키입니다.\n효과와 파라미터는 [📖 옵션_도움말_가이드] 탭을 확인하세요!"),
}


def card_value(card, key):
    if key.startswith('stats.'):
        return (card.get('stats') or {}).get(key[len('stats.'):], '')
    if key == 'mechanicParams':
        return json.dumps(card['mechanicParams'], ensure_ascii=False) if card.get('mechanicParams') else ''
    return card.get(key, '')


def export_to_excel():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        cards = json.load(f)
        if isinstance(cards, dict) and 'cards' in cards:
            cards = cards['cards']

    wb = openpyxl.load_workbook(EXCEL_PATH) if os.path.exists(EXCEL_PATH) else openpyxl.Workbook()

    # =========================================================================
    # SHEET 1: 카드 데이터 편집 시트 (RoguelikeCards)
    # =========================================================================
    if 'RoguelikeCards' in wb.sheetnames:
        ws = wb['RoguelikeCards']
    else:
        ws = wb.active
        ws.title = "RoguelikeCards"

    headers = [c[0] for c in CARD_COLUMNS]
    existing_headers = [ws.cell(row=1, column=i).value for i in range(1, len(headers) + 1)]
    same_layout = existing_headers == headers

    # 기획자가 희귀도 셀에 지정한 배경색 수집 (같은 열 구성일 때만 의미 있음)
    rarity_col = next(i for i, c in enumerate(CARD_COLUMNS, 1) if c[1] == 'rarity')
    rarity_fills = {}
    if same_layout:
        for r in range(2, ws.max_row + 1):
            r_val = ws.cell(row=r, column=rarity_col).value
            c_fill = ws.cell(row=r, column=rarity_col).fill
            if r_val and c_fill and c_fill.fill_type is not None:
                rarity_fills.setdefault(str(r_val).strip(), copy(c_fill))
    else:
        # 열 구성이 바뀐 구형 엑셀은 데이터·너비를 새 구성으로 다시 작성
        ws.delete_rows(1, ws.max_row)
        for col_letter in list(ws.column_dimensions.keys()):
            ws.column_dimensions[col_letter].width = None

    header_font = Font(name="Malgun Gothic", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    border_thin = Side(border_style="thin", color="CCCCCC")
    cell_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

    # 1. 헤더 작성 및 메모(Comment) 부착, 기획자 지정 열 너비 보존
    for col_idx, (col_name, _, default_width, comment_text) in enumerate(CARD_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border
        cell.comment = Comment(comment_text, "DPS: Fire Mage 엔진", height=120, width=280)
        col_letter = get_column_letter(col_idx)
        if not ws.column_dimensions[col_letter].width:
            ws.column_dimensions[col_letter].width = default_width
    ws.row_dimensions[1].height = 30

    # 2. 데이터 행 작성
    row_font = Font(name="Malgun Gothic", size=10)
    centered_keys = {'icon', 'rarity', 'build', 'maxStack'}
    for row_idx, card in enumerate(cards, 2):
        if not ws.row_dimensions[row_idx].height:
            ws.row_dimensions[row_idx].height = 24
        card_rarity = card.get('rarity', 'common')
        for col_idx, (_, key, _, _) in enumerate(CARD_COLUMNS, 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.value = card_value(card, key)
            if key == 'rarity' and card_rarity in rarity_fills:
                cell.fill = copy(rarity_fills[card_rarity])
            if not (cell.fill and cell.fill.fill_type is not None) or key == 'rarity':
                cell.font = row_font
                cell.border = cell_border
            if not cell.alignment or not cell.alignment.horizontal:
                cell.alignment = center_align if (key in centered_keys or key.startswith('stats.')) else left_align

    # 카드가 줄어들어 남은 이전 행 정리
    for extra_row in range(len(cards) + 2, ws.max_row + 1):
        for col_idx in range(1, len(CARD_COLUMNS) + 1):
            cell = ws.cell(row=extra_row, column=col_idx)
            cell.value = None
            cell.fill = PatternFill(fill_type=None)

    # 3. 드롭다운(데이터 유효성 검사) — 기존 검사를 지우고 현재 열 구성 기준으로 다시 추가
    ws.data_validations.dataValidation = []
    last_row = max(len(cards) + 1, 50) + 50
    for col_idx, (_, key, _, _) in enumerate(CARD_COLUMNS, 1):
        if key not in ENUMS:
            continue
        allow_blank = key in ('prerequisite', 'spellKey', 'mechanic')
        dv = DataValidation(type="list", formula1='"' + ','.join(ENUMS[key]) + '"', allow_blank=allow_blank)
        dv.error = f"목록({', '.join(ENUMS[key])})에서 선택" + ("하거나 빈칸으로 두세요." if allow_blank else "해주세요.")
        dv.errorTitle = "유효하지 않은 값"
        dv.promptTitle, dv.prompt = DROPDOWN_PROMPTS[key]
        dv.showInputMessage = True
        ws.add_data_validation(dv)
        letter = get_column_letter(col_idx)
        dv.add(f"{letter}2:{letter}{last_row}")

    ws.freeze_panes = "A2"

    # =========================================================================
    # SHEET 2: 기획자 전용 종합 가이드북 시트 (매번 최신 내용으로 다시 생성)
    # =========================================================================
    guide_widths = {}
    if GUIDE_SHEET in wb.sheetnames:
        old_guide = wb[GUIDE_SHEET]
        guide_widths = {k: v.width for k, v in old_guide.column_dimensions.items() if v.width}
        wb.remove(old_guide)
    ws_guide = wb.create_sheet(title=GUIDE_SHEET)
    ws_guide.views.sheetView[0].showGridLines = True

    guide_title_font = Font(name="Malgun Gothic", size=14, bold=True, color="1E293B")
    sec_font = Font(name="Malgun Gothic", size=11, bold=True, color="FFFFFF")
    sec_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    th_fill = PatternFill(start_color="475569", end_color="475569", fill_type="solid")
    th_font = Font(name="Malgun Gothic", size=10, bold=True, color="FFFFFF")
    code_font = Font(name="Consolas", size=10, bold=True, color="0F172A")
    body_font = Font(name="Malgun Gothic", size=10, color="1E293B")
    bg_alt = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    current_r = 1
    ws_guide.cell(row=current_r, column=1, value="📚 DPS: Fire Mage 마도서 각성 파워업 카드 기획 가이드북").font = guide_title_font
    current_r += 2

    for sec in GUIDE_SECTIONS:
        width = len(sec["headers"])
        sec_cell = ws_guide.cell(row=current_r, column=1, value=sec["title"])
        sec_cell.font = sec_font
        sec_cell.fill = sec_fill
        sec_cell.alignment = left_align
        ws_guide.row_dimensions[current_r].height = 26
        ws_guide.merge_cells(start_row=current_r, start_column=1, end_row=current_r, end_column=width)
        current_r += 1

        desc_cell = ws_guide.cell(row=current_r, column=1, value=sec["desc"])
        desc_cell.font = Font(name="Malgun Gothic", size=9, italic=True, color="64748B")
        ws_guide.row_dimensions[current_r].height = 20
        ws_guide.merge_cells(start_row=current_r, start_column=1, end_row=current_r, end_column=width)
        current_r += 1

        ws_guide.row_dimensions[current_r].height = 24
        for c_idx, h_name in enumerate(sec["headers"], 1):
            h_cell = ws_guide.cell(row=current_r, column=c_idx, value=h_name)
            h_cell.font = th_font
            h_cell.fill = th_fill
            h_cell.alignment = center_align
            h_cell.border = cell_border
        current_r += 1

        for r_idx, row_data in enumerate(sec["rows"]):
            ws_guide.row_dimensions[current_r].height = 22
            for c_idx, val in enumerate(row_data, 1):
                c_cell = ws_guide.cell(row=current_r, column=c_idx, value=val)
                c_cell.font = code_font if c_idx == 1 else body_font
                c_cell.border = cell_border
                if r_idx % 2 == 1:
                    c_cell.fill = bg_alt
                c_cell.alignment = center_align if c_idx in (1, 2) else left_align
            current_r += 1
        current_r += 2

    for i, default_width in enumerate(GUIDE_COL_WIDTHS, 1):
        letter = get_column_letter(i)
        ws_guide.column_dimensions[letter].width = guide_widths.get(letter, default_width)

    try:
        wb.save(EXCEL_PATH)
        print("✨ [성공] 엑셀 파일 생성 완료" + (" (기획자 열 너비·희귀도 배경색 보존)" if same_layout else " (새 열 구성으로 다시 작성)") + ":")
        print(f"   -> {EXCEL_PATH}")
    except PermissionError:
        print("⚠️ [안내] 엑셀 프로그램(Excel)에서 파일이 열려 있어 저장할 수 없습니다.")
        print("   엑셀 파일을 닫은 후 다시 실행해 주세요.")


if __name__ == "__main__":
    export_to_excel()
