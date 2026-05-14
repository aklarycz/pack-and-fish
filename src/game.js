const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function init() {
  ctx.fillStyle = '#eee';
  ctx.font = '24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Paper Empire — prototype', canvas.width / 2, canvas.height / 2);
}

init();
