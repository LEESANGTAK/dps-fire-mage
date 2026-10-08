#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_cards_to_excel.py
- src/data/roguelike-cards.json 데이터를 읽어 드롭다운(Data Validation)과 친절한 설명서/툴팁이 포함된 엑셀 파일(src/data/roguelike-cards.xlsx)로 생성합니다.
- 기능:
  1) 각 셀을 클릭할 때마다 엑셀 입력 메시지(설명 툴팁 말풍선) 자동 팝업
  2) 헤더(1행) 셀마다 상세 안내 메모(Comment) 부착
  3) enum 드롭다운(▼) 지원: rarity, build, prerequisite, spellKey, mechanic
  4) Sheet 2: [📖 옵션_도움말_가이드] 종합 기획 가이드북 탭 제공
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
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.json')
EXCEL_PATH = os.path.join(ROOT_DIR, 'src', 'data', 'roguelike-cards.xlsx')

def export_to_excel():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        cards = json.load(f)
        if isinstance(cards, dict) and 'cards' in cards:
            cards = cards['cards']

    # 기존 엑셀 파일이 있으면 로드하여 기획자 커스텀 서식(배경색, 폰트, 열 너비) 100% 보존
    wb_is_existing = False
    if os.path.exists(EXCEL_PATH):
        try:
            wb = openpyxl.load_workbook(EXCEL_PATH)
            wb_is_existing = True
        except Exception:
            wb = openpyxl.Workbook()
    else:
        wb = openpyxl.Workbook()

    # =========================================================================
    # SHEET 1: 카드 데이터 편집 시트 (RoguelikeCards)
    # =========================================================================
    if 'RoguelikeCards' in wb.sheetnames:
        ws = wb['RoguelikeCards']
    else:
        ws = wb.active
        ws.title = "RoguelikeCards"

    # 헤더 정의: (표시명, JSON 키 매핑, 기본 열 너비, 헤더 메모 설명)
    columns = [
        ("ID", "id", 20, "카드의 고유 시스템 ID입니다. 영문 소문자와 밑줄로 작성합니다.\n(예: rapid_haste_1)"),
        ("이름", "title", 18, "게임 내 카드 상단에 표시될 한글 이름입니다.\n(예: 화염의 손길)"),
        ("아이콘", "icon", 8, "카드 대표 이모지 또는 아이콘 문자입니다.\n(예: ⚡, ☄️, 🔥, 🦅, 📖)"),
        ("희귀도(rarity)", "rarity", 18, "희귀도 등급 (드롭다운 제공):\n- common: 일반 (회색)\n- rare: 희귀 (하늘색)\n- legendary: 전설 (황금색, 보스전 우대)"),
        ("빌드(build)", "build", 16, "카드의 빌드 분류 태그 (드롭다운 제공):\n- rapid: ⚡ 속사 머신건\n- crit: 🎯 극치명 누킹\n- summon: 🔥 정령 군단\n- utility: ✨ 유틸리티"),
        ("최대중첩", "maxStack", 10, "한 런(Run)에서 최대로 습득 가능한 횟수입니다.\n이 횟수만큼 습득하면 이후 3지선다 추첨 풀에서 자동 제외됩니다. (보통 1~5)"),
        ("설명(desc)", "desc", 42, "게임 내 카드 본문에 표시될 효과 설명문입니다.\n강조할 수치는 <b>+25%</b> 태그로 감싸면 굵게 표시됩니다."),
        ("주문력(sp)", "stats.sp", 12, "습득 시 플레이어의 주문력(Spell Power)에 영구 가산됩니다."),
        ("가속도(haste)", "stats.haste", 12, "습득 시 플레이어의 가속도(% 단위)에 가산되어 시전 및 글쿨이 빨라집니다."),
        ("치명타(crit)", "stats.crit", 12, "습득 시 플레이어의 치명타율(% 단위)에 가산됩니다."),
        ("치명피해(critDmg)", "stats.critDmg", 14, "습득 시 치명타 피해 배율에 가산됩니다.\n배율 단위로 입력합니다. (예: 0.4 = +40%)"),
        ("골드보너스(goldBonus)", "stats.goldBonus", 16, "습득 시 몬스터 처치 골드 획득 배율에 가산됩니다.\n배율 단위로 입력합니다. (예: 0.6 = +60%)"),
        ("선행조건(prerequisite)", "prerequisite", 24, "3지선다에 등장하기 위한 선행 조건 (드롭다운 제공):\n- has_summon: 화염 정령 보유 시에만 등장\n- has_meteor: 메테오 습득 시에만 등장\n- has_combustion: 마력 폭주 습득 시에만 등장\n- has_any_spell: 쿨다운 스킬 습득 시에만 등장\n- (빈칸): 조건 없이 항상 등장"),
        ("해금스킬(spellKey)", "spellKey", 20, "고대 주문서 카드 습득 시 액션바에 해금할 스킬 키 (드롭다운 제공):\n- autocast, fireblast, meteor, combustion, flame_patch"),
        ("특수기믹(mechanic)", "mechanic", 24, "시스템에 내장된 특수 고유 로직 키입니다.\n자세한 키 목록과 기능은 하단의 [📖 옵션_도움말_가이드] 시트를 참고하세요."),
        ("기믹파라미터(JSON)", "mechanicParams", 22, "특수 기믹에 전달할 세부 JSON 수치입니다.\n(예: {\"executionerMult\": 0.7})")
    ]

    header_font = Font(name="Malgun Gothic", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    border_thin = Side(border_style="thin", color="CCCCCC")
    cell_border = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

    # 1. 헤더 작성 및 메모(Comment) 부착, 기획자 지정 열 너비 보존
    for col_idx, (col_name, _, default_width, comment_text) in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border
        cell.comment = Comment(comment_text, "DPS: Fire Mage 엔진", height=120, width=280)
        col_letter = get_column_letter(col_idx)
        # 열 너비가 아직 없거나 기본값일 때만 기본값 적용 (기획자 설정값 보존)
        if not ws.column_dimensions[col_letter].width:
            ws.column_dimensions[col_letter].width = default_width

    ws.row_dimensions[1].height = 30

    # 2. 데이터 행 작성 (기획자가 지정한 희귀도 셀 배경색/폰트 서식 100% 영구 보존!)
    # (1) 기존 시트에서 각 희귀도(common, rare, legendary 등)별 기획자 커스텀 fill 수집
    from copy import copy
    rarity_fills = {}
    if wb_is_existing:
        for r in range(2, ws.max_row + 1):
            r_val = ws.cell(row=r, column=4).value
            c_fill = ws.cell(row=r, column=4).fill
            if r_val and c_fill and c_fill.fill_type is not None:
                r_key = str(r_val).strip()
                if r_key not in rarity_fills:
                    rarity_fills[r_key] = copy(c_fill)

    row_font = Font(name="Malgun Gothic", size=10)
    for row_idx, card in enumerate(cards, 2):
        if not ws.row_dimensions[row_idx].height:
            ws.row_dimensions[row_idx].height = 24

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

        card_rarity = card.get('rarity', 'common')
        for col_idx, val in enumerate(row_values, 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.value = val

            # 희귀도 열(D열, col 4)은 수집된 희귀도별 커스텀 배경색 자동 동기화
            if col_idx == 4 and card_rarity in rarity_fills:
                cell.fill = copy(rarity_fills[card_rarity])
                cell.font = row_font
                cell.border = cell_border
            else:
                has_custom_fill = (cell.fill and cell.fill.fill_type is not None)
                if not has_custom_fill:
                    cell.font = row_font
                    cell.border = cell_border

            # 정렬
            if not cell.alignment or not cell.alignment.horizontal:
                if col_idx in [3, 4, 5, 6, 8, 9, 10, 11, 12]:
                    cell.alignment = center_align
                else:
                    cell.alignment = left_align

    # 카드가 줄어들어 남은 이전 행들의 셀 값 클리어
    current_max = ws.max_row
    for extra_row in range(len(cards) + 2, current_max + 1):
        for col_idx in range(1, len(columns) + 1):
            cell = ws.cell(row=extra_row, column=col_idx)
            cell.value = None
            cell.fill = PatternFill(fill_type=None)

    total_rows = max(len(cards) + 1, 50)

    # 3. 데이터 유효성 검사 (드롭다운 enum 설정 + 셀 클릭 시 안내 툴팁 InputMessage 설정)
    # (1) rarity 드롭다운 (D열 = col 4)
    dv_rarity = DataValidation(type="list", formula1='"common,rare,legendary"', allow_blank=False)
    dv_rarity.error = "희귀도는 common, rare, legendary 중에서 선택해주세요."
    dv_rarity.errorTitle = "유효하지 않은 희귀도"
    dv_rarity.promptTitle = "[희귀도(rarity) 옵션 안내]"
    dv_rarity.prompt = "• common: 일반 (회색 테두리)\n• rare: 희귀 (하늘색 테두리)\n• legendary: 전설 (황금 테두리, 보스전 우대)"
    dv_rarity.showInputMessage = True
    ws.add_data_validation(dv_rarity)
    dv_rarity.add(f"D2:D{total_rows + 50}")

    # (2) build 드롭다운 (E열 = col 5)
    dv_build = DataValidation(type="list", formula1='"rapid,crit,summon,utility"', allow_blank=False)
    dv_build.error = "빌드는 rapid, crit, summon, utility 중에서 선택해주세요."
    dv_build.errorTitle = "유효하지 않은 빌드"
    dv_build.promptTitle = "[빌드(build) 분류 안내]"
    dv_build.prompt = "• rapid: 속사/가속 화염구 난사\n• crit: 극치명타 몰열 메테오 누킹\n• summon: 화염 정령 군단\n• utility: 처형·골드·쿨다운 등 범용 효과"
    dv_build.showInputMessage = True
    ws.add_data_validation(dv_build)
    dv_build.add(f"E2:E{total_rows + 50}")

    # (3) prerequisite 드롭다운 (M열 = col 13)
    dv_prereq = DataValidation(type="list", formula1='"has_summon,has_meteor,has_combustion,has_any_spell"', allow_blank=True)
    dv_prereq.error = "선행조건 목록에서 선택하거나 빈칸으로 두세요."
    dv_prereq.errorTitle = "유효하지 않은 선행조건"
    dv_prereq.promptTitle = "[선행조건(prerequisite) 안내]"
    dv_prereq.prompt = "해당 조건이 달성되어야만 3지선다에 등장합니다:\n• has_summon: 화염 정령 보유 시\n• has_meteor: 메테오 습득 시\n• has_combustion: 마력 폭주 습득 시\n• has_any_spell: 쿨다운 보조 마법 1개 이상 습득 시\n• (빈칸): 조건 없이 항상 등장"
    dv_prereq.showInputMessage = True
    ws.add_data_validation(dv_prereq)
    dv_prereq.add(f"M2:M{total_rows + 50}")

    # (4) spellKey 드롭다운 (N열 = col 14)
    dv_spell = DataValidation(type="list", formula1='"autocast,fireblast,meteor,combustion,flame_patch"', allow_blank=True)
    dv_spell.error = "해금스킬 키 목록에서 선택하거나 빈칸으로 두세요."
    dv_spell.errorTitle = "유효하지 않은 스킬 키"
    dv_spell.promptTitle = "[해금스킬(spellKey) 안내]"
    dv_spell.prompt = "주문서 카드 습득 시 액션바에 해금할 스킬:\n• autocast: 자동 시전 마법진\n• fireblast: 불꽃 작렬\n• meteor: 메테오\n• combustion: 마력 폭주\n• flame_patch: 불장판"
    dv_spell.showInputMessage = True
    ws.add_data_validation(dv_spell)
    dv_spell.add(f"N2:N{total_rows + 50}")

    # (5) mechanic 드롭다운 (O열 = col 15)
    dv_mech = DataValidation(type="list", formula1='"split_fireball,gatling_mode,meteor_buff,combustion_god,extra_spirit,synchronized_fire,cinder_lord,executioner,phoenix_reset"', allow_blank=True)
    dv_mech.error = "특수기믹 키 목록에서 선택하거나 빈칸으로 두세요."
    dv_mech.errorTitle = "유효하지 않은 기믹 키"
    dv_mech.promptTitle = "[특수기믹(mechanic) 안내]"
    dv_mech.prompt = "시스템 특수 로직 키입니다.\n자세한 효과와 설정값은 하단의 [📖 옵션_도움말_가이드] 탭을 확인하세요!"
    dv_mech.showInputMessage = True
    ws.add_data_validation(dv_mech)
    dv_mech.add(f"O2:O{total_rows + 50}")

    # 틀 고정 (헤더 고정)
    ws.freeze_panes = "A2"

    # =========================================================================
    # SHEET 2: 기획자 전용 종합 가이드북 시트 (📖 옵션_도움말_가이드)
    # =========================================================================
    ws_guide = wb.create_sheet(title="📖 옵션_도움말_가이드")
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

    # 문서 제목
    ws_guide.cell(row=current_r, column=1, value="📚 DPS: Fire Mage 마도서 각성 파워업 카드 기획 가이드북").font = guide_title_font
    current_r += 2

    guide_sections = [
        {
            "title": "1. 희귀도 등급 (rarity) 가이드",
            "desc": "카드의 희귀도는 카드 테두리 색상 및 추첨 확률(가중치)을 결정합니다.",
            "headers": ["값 (Enum)", "한글 명칭", "시각 효과 / 테두리", "게임 내 등장 규칙"],
            "col_widths": [18, 14, 22, 45],
            "rows": [
                ["common", "일반", "회색/슬레이트 테두리", "일반 웨이브 가중치 75, 보스 웨이브에서는 등장하지 않음"],
                ["rare", "희귀", "하늘색 테두리", "일반 웨이브 가중치 21, 보스 웨이브 가중치 85"],
                ["legendary", "전설", "황금빛 테두리", "일반 웨이브 가중치 4, 보스 웨이브 가중치 15"]
            ]
        },
        {
            "title": "2. 빌드 성향 (build) 가이드",
            "desc": "카드가 어떤 전투 플레이스타일을 지향하는지 분류하는 태그입니다. 각성 카드에 빌드 배지로 표시됩니다.",
            "headers": ["값 (Enum)", "카드 배지", "주요 컨셉", "대표 카드 / 메커니즘"],
            "col_widths": [18, 16, 25, 45],
            "rows": [
                ["rapid", "⚡ 속사 머신건", "화염구 난사 및 시전 가속", "시전 속도·주문력 강화, 분열 화염구, 화염 기관총, 불장판"],
                ["crit", "🎯 극치명 누킹", "몰아치는 열기 및 메테오 폭딜", "치명타 강화, 불꽃 작렬, 메테오, 마력 폭주 및 강화"],
                ["summon", "🔥 정령 군단", "화염 정령 소환 및 협공", "정령 추가 소환, 일제 협공 사격, 잿더미 군단장"],
                ["utility", "✨ 유틸리티", "범용 강화 및 경제", "처형인, 골드 보너스, 쿨다운 초기화, 자동 시전 마법진"]
            ]
        },
        {
            "title": "3. 선행 조건 필터 (prerequisite) 가이드",
            "desc": "특정 조건을 만족했을 때만 3지선다 목록에 등장하도록 제어하는 필터입니다. (비어있으면 무조건 등장)",
            "headers": ["값 (Enum)", "등장 조건", "기획 의도 및 목적"],
            "col_widths": [20, 25, 55],
            "rows": [
                ["(빈칸)", "조건 없음", "처음부터 누구나 언제든 획득 가능한 기본 카드"],
                ["has_summon", "화염 정령 보유 시", "정령이 없는데 소환수 강화 카드가 나와서 선택지를 낭비하는 현상 방지"],
                ["has_meteor", "메테오 습득 시", "메테오를 배우지 않은 상태에서 메테오 강화 카드가 뜨는 현상 방지"],
                ["has_combustion", "마력 폭주 습득 시", "마력 폭주를 배운 상태에서만 '진홍의 마력 폭주' 등의 카드가 등장"],
                ["has_any_spell", "쿨다운 스킬 1개 이상 습득 시", "불꽃 작렬·메테오·마력 폭주·불장판이 없는데 '쿨다운 초기화' 카드가 떠서 무용지물이 되는 현상 방지"]
            ]
        },
        {
            "title": "4. 고대 주문서 해금 스킬 (spellKey) 가이드",
            "desc": "주문서 카드를 획득했을 때 즉시 플레이어에게 해금해 줄 스킬 식별자입니다. 이미 습득한 주문서는 3지선다에 다시 등장하지 않습니다.",
            "headers": ["값 (Enum)", "해금되는 스킬명", "스킬 유형", "스킬 효과 요약"],
            "col_widths": [18, 18, 18, 45],
            "rows": [
                ["autocast", "자동 시전 마법진", "패시브 마법진", "발아래 마법진 전개, 습득한 스킬을 쿨다운마다 자동 연계 시전"],
                ["fireblast", "불꽃 작렬", "보조 즉발기", "시전 중에도 즉시 발사되는 100% 확정 치명타 마법 (2회 충전)"],
                ["meteor", "메테오", "강타기", "주문력 320% 운석 투하 및 6초 연소, 치명타 2연속(몰열) 시 즉시 노코스트 시전"],
                ["combustion", "마력 폭주", "버프 극딜기", "2초간 모든 마법 치명타 100% 확정 및 시전 속도 +20%"],
                ["flame_patch", "불장판", "지속 피해기", "몬스터 발밑에 7초간 화염 지대 생성, 0.5초마다 주문력 40% 피해"]
            ]
        },
        {
            "title": "5. 특수 고유 메커니즘 (mechanic) 및 파라미터 가이드",
            "desc": "단순 스탯 증가가 아닌 인게임 전투 시스템의 룰을 직접 변경하는 고유 특수 효과입니다.",
            "headers": ["기믹 키 (mechanic)", "효과 명칭", "동작 메커니즘 설명", "기믹 파라미터 예시 (JSON)"],
            "col_widths": [22, 18, 48, 28],
            "rows": [
                ["split_fireball", "분열 화염구", "화염구 적중 시 작은 불씨가 분열되어 추가 타격합니다. (스택당 2개, 최대 6개, 각 주문력 40%)", "없음"],
                ["gatling_mode", "화염 기관총", "화염구 기본 시전 시간과 공통 대기 시간이 0.3초로 단축됩니다. (최소 0.12초)", "없음"],
                ["meteor_buff", "태양석 메테오", "메테오를 습득시키고, 스택당 재사용 대기 50% 감소(최소 4초)·피해 +60%가 적용됩니다.", "없음"],
                ["combustion_god", "진홍의 마력 폭주", "마력 폭주를 습득시키고, 지속시간 2배·폭주 중 모든 피해 2.5배가 적용됩니다.", "없음"],
                ["extra_spirit", "화염 정령 소환", "화염 정령을 1기 추가 소환합니다. (최대 4기, 1.3초마다 주문력 45% x 정령 수 피해)", "없음"],
                ["synchronized_fire", "일제 협공 사격", "마법사가 화염구를 발사할 때마다 모든 정령이 동시에 협공합니다.", "없음"],
                ["cinder_lord", "잿더미 군단장", "소환수 1기당 마법사의 모든 주문 피해가 +30% 증폭됩니다.", "없음"],
                ["executioner", "처형인의 불꽃", "적 체력이 40% 이하일 때 모든 피해량이 executionerMult만큼 증가합니다. (스택 시 합산)", "{\"executionerMult\": 0.7}"],
                ["phoenix_reset", "불사조의 가호", "치명타 적중 시 15% 확률로 모든 스킬의 재사용 대기가 초기화되고, 2.4초마다 불사조가 확정 치명타로 협공합니다.", "없음"]
            ]
        },
        {
            "title": "6. 스탯 (stats) 컬럼 가이드",
            "desc": "카드 습득 시 플레이어의 기본 능력치에 런(Run) 동안 누적되는 스탯 항목입니다.",
            "headers": ["열 이름", "스탯 키", "단위 및 계산 방식", "인게임 효과"],
            "col_widths": [18, 14, 20, 50],
            "rows": [
                ["주문력(sp)", "sp", "정수 (절대값, 기본 10)", "모든 스킬(화염구, 메테오, 불꽃 작렬 등)의 기본 피해량에 직접 가산"],
                ["가속도(haste)", "haste", "% (예: 30 = +30%)", "시전 바 진행 속도 증가 및 공통 대기 시간(GCD) 단축"],
                ["치명타(crit)", "crit", "%p (예: 15 = +15%, 기본 5%)", "모든 공격의 치명타 발생 확률 증가 (몰열 2연속 발동에 핵심 기여)"],
                ["치명피해(critDmg)", "critDmg", "배율 (예: 0.4 = +40%)", "치명타 발생 시 기본 150% 피해 배율에 가산"],
                ["골드보너스(goldBonus)", "goldBonus", "배율 (예: 0.6 = +60%)", "몬스터 처치 골드 획득량 증가 (골드는 각성 카드 다시 뽑기에 사용)"]
            ]
        }
    ]

    for sec in guide_sections:
        # 섹션 헤더
        sec_cell = ws_guide.cell(row=current_r, column=1, value=sec["title"])
        sec_cell.font = sec_font
        sec_cell.fill = sec_fill
        sec_cell.alignment = left_align
        ws_guide.row_dimensions[current_r].height = 26
        # 섹션 제목 가로 병합
        ws_guide.merge_cells(start_row=current_r, start_column=1, end_row=current_r, end_column=len(sec["headers"]))
        current_r += 1

        # 섹션 부가설명
        desc_cell = ws_guide.cell(row=current_r, column=1, value=sec["desc"])
        desc_cell.font = Font(name="Malgun Gothic", size=9, italic=True, color="64748B")
        ws_guide.row_dimensions[current_r].height = 20
        ws_guide.merge_cells(start_row=current_r, start_column=1, end_row=current_r, end_column=len(sec["headers"]))
        current_r += 1

        # 테이블 헤더
        ws_guide.row_dimensions[current_r].height = 24
        for c_idx, h_name in enumerate(sec["headers"], 1):
            h_cell = ws_guide.cell(row=current_r, column=c_idx, value=h_name)
            h_cell.font = th_font
            h_cell.fill = th_fill
            h_cell.alignment = center_align
            h_cell.border = cell_border
        current_r += 1

        # 테이블 데이터
        for r_idx, row_data in enumerate(sec["rows"]):
            ws_guide.row_dimensions[current_r].height = 22
            is_alt = (r_idx % 2 == 1)
            for c_idx, val in enumerate(row_data, 1):
                c_cell = ws_guide.cell(row=current_r, column=c_idx, value=val)
                c_cell.font = code_font if c_idx == 1 else body_font
                c_cell.border = cell_border
                if is_alt:
                    c_cell.fill = bg_alt
                if c_idx in [1, 2]:
                    c_cell.alignment = center_align
                else:
                    c_cell.alignment = left_align
            current_r += 1

        current_r += 2  # 섹션 간 여백

    # 가이드 시트 컬럼 너비 조정 (기존 조절값 우선 보존)
    if not ws_guide.column_dimensions['A'].width: ws_guide.column_dimensions['A'].width = 24
    if not ws_guide.column_dimensions['B'].width: ws_guide.column_dimensions['B'].width = 24
    if not ws_guide.column_dimensions['C'].width: ws_guide.column_dimensions['C'].width = 30
    if not ws_guide.column_dimensions['D'].width: ws_guide.column_dimensions['D'].width = 55

    try:
        wb.save(EXCEL_PATH)
        print(f"✨ [성공] 엑셀 파일(기획자 커스텀 열 너비 및 셀 배경색 100% 보존 완료):")
        print(f"   -> {EXCEL_PATH}")
    except PermissionError:
        print(f"⚠️ [안내] 엑셀 프로그램(Excel)에서 파일이 열려 있어 저장할 수 없습니다.")
        print(f"   기획자님이 엑셀에서 작업 중이실 때는 읽기 동기화(sync-cards.bat)를 사용하시면 되며,")
        print(f"   엑셀 파일을 닫으신 후 본 스크립트를 실행하시면 커스텀 서식이 100% 보존되어 저장됩니다.")

if __name__ == "__main__":
    export_to_excel()
