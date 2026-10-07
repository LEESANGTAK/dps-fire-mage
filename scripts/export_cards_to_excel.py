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
        ("희귀도(rarity)", "rarity", 18, "희귀도 등급 (드롭다운 제공):\n- common: 일반 (회색)\n- rare: 희귀 (하늘색)\n- epic: 영웅 (보라색)\n- legendary: 전설 (황금색, 보스전 우대)"),
        ("빌드(build)", "build", 16, "카드의 빌드 분류 태그 (드롭다운 제공):\n- rapid: 속사/가속 머신건\n- crit: 극치명타 몰열 누킹\n- pet: 불사조 정령 군단\n- util: 생존/골드 유틸\n- spell: 고대 주문서 해금"),
        ("최대중첩", "maxStack", 10, "한 런(Run)에서 최대로 습득 가능한 횟수입니다.\n이 횟수만큼 습득하면 이후 3지선다 추첨 풀에서 자동 제외됩니다. (보통 1~5)"),
        ("설명(desc)", "desc", 42, "게임 내 카드 본문에 표시될 효과 설명문입니다.\n강조할 수치는 <b>+25%</b> 태그로 감싸면 굵게 표시됩니다."),
        ("주문력(sp)", "stats.sp", 12, "습득 시 플레이어의 주문력(Spell Power)에 영구 가산됩니다."),
        ("가속도(haste)", "stats.haste", 12, "습득 시 플레이어의 가속도(% 단위)에 가산되어 시전 및 글쿨이 빨라집니다."),
        ("치명타(crit)", "stats.crit", 12, "습득 시 플레이어의 치명타율(% 단위)에 가산됩니다."),
        ("치명피해(critDmg)", "stats.critDmg", 14, "습득 시 치명타 피해 배율(% 단위)에 가산됩니다."),
        ("골드보너스(goldBonus)", "stats.goldBonus", 16, "습득 시 몬스터 처치 골드 획득 배율(% 단위)에 가산됩니다."),
        ("선행조건(prerequisite)", "prerequisite", 24, "3지선다에 등장하기 위한 선행 조건 (드롭다운 제공):\n- has_summon: 소환수 보유 시에만 등장\n- has_meteor: 메테오 습득 시에만 등장\n- has_combustion: 발화 습득 시에만 등장\n- has_any_spell: 쿨다운 스킬 습득 시에만 등장\n- (빈칸): 조건 없이 항상 등장"),
        ("해금스킬(spellKey)", "spellKey", 20, "고대 주문서 카드 습득 시 액션바에 해금할 스킬 키 (드롭다운 제공):\n- fireblast, meteor, combustion, summon, ice_barrier"),
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
    dv_rarity = DataValidation(type="list", formula1='"common,rare,epic,legendary"', allow_blank=False)
    dv_rarity.error = "희귀도는 common, rare, epic, legendary 중에서 선택해주세요."
    dv_rarity.errorTitle = "유효하지 않은 희귀도"
    dv_rarity.promptTitle = "[희귀도(rarity) 옵션 안내]"
    dv_rarity.prompt = "• common: 일반 (회색 테두리)\n• rare: 희귀 (파란색 테두리)\n• epic: 영웅 (보라색 테두리)\n• legendary: 전설 (황금 테두리, 보스전 우대)"
    dv_rarity.showInputMessage = True
    ws.add_data_validation(dv_rarity)
    dv_rarity.add(f"D2:D{total_rows + 50}")

    # (2) build 드롭다운 (E열 = col 5)
    dv_build = DataValidation(type="list", formula1='"rapid,crit,pet,util,spell"', allow_blank=False)
    dv_build.error = "빌드는 rapid, crit, pet, util, spell 중에서 선택해주세요."
    dv_build.errorTitle = "유효하지 않은 빌드"
    dv_build.promptTitle = "[빌드(build) 분류 안내]"
    dv_build.prompt = "• rapid: 속사/가속 화염구 난사\n• crit: 극치명타 몰열 메테오 누킹\n• pet: 불사조 정령 군단\n• util: 생존력 및 골드 유틸\n• spell: 고대 주문서 스킬 해금"
    dv_build.showInputMessage = True
    ws.add_data_validation(dv_build)
    dv_build.add(f"E2:E{total_rows + 50}")

    # (3) prerequisite 드롭다운 (M열 = col 13)
    dv_prereq = DataValidation(type="list", formula1='"has_summon,has_meteor,has_combustion,has_fireblast,has_ice_barrier,has_any_spell"', allow_blank=True)
    dv_prereq.error = "선행조건 목록에서 선택하거나 빈칸으로 두세요."
    dv_prereq.errorTitle = "유효하지 않은 선행조건"
    dv_prereq.promptTitle = "[선행조건(prerequisite) 안내]"
    dv_prereq.prompt = "해당 조건이 달성되어야만 3지선다에 등장합니다:\n• has_summon: 소환수 보유 시\n• has_meteor: 메테오 습득 시\n• has_combustion: 발화 습득 시\n• has_any_spell: 쿨다운 보조 마법 1개 이상 습득 시\n• (빈칸): 조건 없이 항상 등장"
    dv_prereq.showInputMessage = True
    ws.add_data_validation(dv_prereq)
    dv_prereq.add(f"M2:M{total_rows + 50}")

    # (4) spellKey 드롭다운 (N열 = col 14)
    dv_spell = DataValidation(type="list", formula1='"fireblast,meteor,combustion,summon,ice_barrier,autocast"', allow_blank=True)
    dv_spell.error = "해금스킬 키 목록에서 선택하거나 빈칸으로 두세요."
    dv_spell.errorTitle = "유효하지 않은 스킬 키"
    dv_spell.promptTitle = "[해금스킬(spellKey) 안내]"
    dv_spell.prompt = "주문서 카드 습득 시 액션바에 해금할 스킬:\n• fireblast: 불꽃 작렬\n• meteor: 유성낙하\n• combustion: 발화\n• summon: 불사조 소환\n• ice_barrier: 얼음 보호막\n• autocast: 자동 시전 마법진"
    dv_spell.showInputMessage = True
    ws.add_data_validation(dv_spell)
    dv_spell.add(f"N2:N{total_rows + 50}")

    # (5) mechanic 드롭다운 (O열 = col 15)
    dv_mech = DataValidation(type="list", formula1='"split_fireball,haste_stack,gatling_mode,chain_hot_streak,meteor_buff,combustion_god,extra_spirit,spirit_frenzy,synchronized_fire,cinder_lord,executioner,phoenix_reset"', allow_blank=True)
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
                ["common", "일반", "회색/슬레이트 테두리", "기본 등장 확률이 가장 높으며 주로 기본 스탯 강화 제공"],
                ["rare", "희귀", "하늘색 테두리", "중간 확률로 등장하며 빌드의 핵심 시너지 카드 구성"],
                ["epic", "영웅", "보라색 테두리", "낮은 확률로 등장하며 빌드를 완성하는 강력한 위력 제공"],
                ["legendary", "전설", "황금빛 테두리", "매우 희귀하게 등장하며 보스 웨이브 클리어 시 우대 확률 적용"]
            ]
        },
        {
            "title": "2. 빌드 성향 (build) 가이드",
            "desc": "카드가 어떤 전투 플레이스타일을 지향하는지 분류하는 태그입니다.",
            "headers": ["값 (Enum)", "한글 명칭", "주요 컨셉", "핵심 메커니즘"],
            "col_widths": [18, 14, 25, 45],
            "rows": [
                ["rapid", "속사 머신건", "화염구 난사 및 극한의 가속도", "시전 속도 단축, 화염구 분열, 게틀링 연속 발사"],
                ["crit", "극치명타 몰열", "몰아치는 열기 누킹 및 메테오", "확정 치명타 연계, 노코스트 메테오 투하, 발화 피버"],
                ["pet", "정령 군단", "불사조 소환수 소환 및 군단 지휘", "소환수 추가 소환, 소환수 공격 속도/피해량 증폭, 일제 사격"],
                ["util", "유틸리티", "생존 및 경제적 보상 극대화", "처형인 추가 피해, 골드 획득량 대폭 증가, 쿨다운 초기화"],
                ["spell", "고대 주문서", "새로운 마법 스킬 습득", "액션바에 새로운 스킬 슬롯 해금 및 자동 시전 마법진 전개"]
            ]
        },
        {
            "title": "3. 선행 조건 필터 (prerequisite) 가이드",
            "desc": "특정 조건을 만족했을 때만 3지선다 목록에 등장하도록 제어하는 필터입니다. (비어있으면 무조건 등장)",
            "headers": ["값 (Enum)", "등장 조건", "기획 의도 및 목적"],
            "col_widths": [20, 25, 55],
            "rows": [
                ["(빈칸)", "조건 없음", "처음부터 누구나 언제든 획득 가능한 기본 카드"],
                ["has_summon", "불사조 소환수 보유 시", "소환수가 없는데 소환수 강화 카드가 나와서 선택지를 낭비하는 현상 방지"],
                ["has_meteor", "유성낙하(메테오) 습득 시", "메테오를 배우지 않은 상태에서 메테오 강화 카드가 뜨는 현상 방지"],
                ["has_combustion", "발화(Combustion) 습득 시", "발화 스킬을 배운 상태에서만 '발화의 화신' 등의 카드가 등장"],
                ["has_fireblast", "화염 작렬 습득 시", "화염 작렬 스킬 보유자에게만 전용 강화 카드 제공"],
                ["has_any_spell", "쿨다운 보조 마법 1개 이상 습득 시", "쿨다운 스킬이 없는데 '자동 시전'이나 '쿨다운 초기화' 카드가 떠서 무용지물이 되는 현상 방지"]
            ]
        },
        {
            "title": "4. 고대 주문서 해금 스킬 (spellKey) 가이드",
            "desc": "build가 'spell'인 카드를 획득했을 때 즉시 플레이어에게 해금해 줄 스킬 식별자입니다.",
            "headers": ["값 (Enum)", "해금되는 스킬명", "스킬 유형", "스킬 효과 요약"],
            "col_widths": [18, 18, 18, 45],
            "rows": [
                ["autocast", "비전 마법진 (자동 시전)", "패시브 마법진", "발아래 마법진 전개, 쿨다운마다 배운 스킬 자동 연계 시전"],
                ["fireblast", "불꽃 작렬", "보조 즉발기", "시전 중에도 즉시 발사되는 100% 확정 치명타 마법"],
                ["meteor", "유성낙하 (메테오)", "광역 궁극기", "거대 운석 투하, 치명타 2연속(몰열) 시 즉시 노코스트 시전"],
                ["combustion", "발화", "버프 극딜기", "10초간 모든 마법 치명타 100% 확정 및 마력 폭주"],
                ["summon", "불사조 정령", "전투 소환수", "항시 함께 전투하며 목표를 지속 공격하는 소환수 소환"],
                ["ice_barrier", "얼음 보호막", "생존 방어기", "최대 체력의 40% 보호막 생성 및 상태이상 방어"]
            ]
        },
        {
            "title": "5. 특수 고유 메커니즘 (mechanic) 및 파라미터 가이드",
            "desc": "단순 스탯 증가가 아닌 인게임 전투 시스템의 룰을 직접 변경하는 고유 특수 효과입니다.",
            "headers": ["기믹 키 (mechanic)", "효과 명칭", "동작 메커니즘 설명", "기믹 파라미터 예시 (JSON)"],
            "col_widths": [22, 18, 48, 28],
            "rows": [
                ["split_fireball", "화염구 2갈래 분열", "화염구 시전 시 탄환이 2개로 갈라져 2번 타격합니다.", "없음 (단독 발동)"],
                ["haste_stack", "가속도 중첩 버프", "화염구 적중 시마다 가속도가 5%씩 최대 5중첩까지 증가합니다.", "없음"],
                ["gatling_mode", "게틀링 머신건 모드", "연속 시전 시 화염구 시전 시간이 0.4초까지 극한으로 단축됩니다.", "없음"],
                ["chain_hot_streak", "연쇄 몰아치는 열기", "몰열 메테오 투하 시 지정된 확률로 몰열이 즉시 재발동합니다.", "{\"chainHotStreak\": 0.4}"],
                ["meteor_buff", "거대 운석 폭격", "메테오의 낙하 반경과 피해량이 2배로 증가합니다.", "없음"],
                ["combustion_god", "발화의 절대자", "발화 유지 시간이 5초 증가하고 치명타 피해가 50% 추가 증가합니다.", "없음"],
                ["extra_spirit", "정령 군단 추가 소환", "소환할 수 있는 정령의 수가 +1 증가하여 동시 출격합니다.", "없음"],
                ["spirit_frenzy", "정령 광란의 축제", "정령의 공격 속도와 공격력이 대폭 증가합니다.", "{\"spiritDamageMult\": 1.4, \"spiritSpeedMult\": 1.5}"],
                ["synchronized_fire", "일제 사격 연계", "마법사가 스킬을 시전할 때 소환수도 동일한 방향으로 동시 사격합니다.", "없음"],
                ["cinder_lord", "불씨의 군주", "소환수 주변에 항시 불길이 피어올라 적에게 도트 피해를 입힙니다.", "없음"],
                ["executioner", "처형인의 일격", "적 체력이 40% 이하일 때 가하는 모든 피해량이 증가합니다.", "{\"executionerMult\": 0.7}"],
                ["phoenix_reset", "불사조의 가호", "치명타 적중 시 15% 확률로 모든 스킬의 쿨다운이 즉시 리셋됩니다.", "없음"]
            ]
        },
        {
            "title": "6. 스탯 (stats) 컬럼 가이드",
            "desc": "카드 습득 시 플레이어의 기본 능력치에 영구 누적되는 스탯 항목입니다.",
            "headers": ["열 이름", "스탯 키", "단위 및 계산 방식", "인게임 효과"],
            "col_widths": [18, 14, 20, 50],
            "rows": [
                ["주문력(sp)", "sp", "정수 (절대값)", "모든 스킬(화염구, 메테오, 불꽃작렬)의 기본 피해량에 직접 가산"],
                ["가속도(haste)", "haste", "% (백분율)", "시전 바 진행 속도 증가 및 글로벌 쿨다운(GCD) 단축"],
                ["치명타(crit)", "crit", "% (백분율)", "모든 공격의 치명타 발생 확률 증가 (몰열 2연속 발동에 핵심 기여)"],
                ["치명피해(critDmg)", "critDmg", "% (백분율)", "치명타 발생 시 기본 150% 피해량에 추가 가산"],
                ["골드보너스(goldBonus)", "goldBonus", "% (백분율)", "몬스터 처치 및 보스 격파 시 드롭되는 골드 획득량 증가"]
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
