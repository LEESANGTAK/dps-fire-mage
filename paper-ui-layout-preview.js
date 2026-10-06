/* 실제 HTML·CSS를 사용하는 위치 검증 화면. 전투·진행·저장 로직은 실행하지 않는다. */
const layoutMage = new Image();
layoutMage.src = 'assets/art/paper-mage-poses.png';
function drawLayoutMage() {
  const frame = PAPER_ART_FRAMES.mage[document.querySelector('#preview-pose').value];
  const ctx = document.querySelector('#mage-pose-canvas').getContext('2d');
  ctx.clearRect(0, 0, 640, 640);
  ctx.drawImage(layoutMage, ...frame.box, frame.box[0] - frame.foot[0] + 294,
    frame.box[1] - frame.foot[1] + 638, frame.box[2], frame.box[3]);
}
layoutMage.addEventListener('load', drawLayoutMage);
document.querySelector('#preview-pose').addEventListener('change', drawLayoutMage);
function showLayoutMonster() { configureComicMonster(Number(document.querySelector('#preview-monster').value)); }
document.querySelector('#preview-monster').addEventListener('change', showLayoutMonster);
showLayoutMonster();
